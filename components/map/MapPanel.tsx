'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import maplibregl, { type Map as MlMap, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { format, parseISO } from 'date-fns';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import type { CountryStat, Case, CaseLocation } from '@/lib/types';
import { countryBucket, BUCKET_COLOR } from '@/lib/map-colors';
import { STATUS_COLOR, statusRgb, caseLocationsFor, currentLocation, caseLabel } from '@/lib/case-helpers';

const TILE_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface Props {
  countries: CountryStat[];
  cases: Case[];
  caseLocations: CaseLocation[];
  selectedCaseId?: string | null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function stopTooltipHTML(s: CaseLocation, index: number, total: number): string {
  const arrived = format(parseISO(s.arrived_at), 'MMM d, HH:mm') + ' UTC';
  const departed = s.departed_at ? format(parseISO(s.departed_at), 'MMM d, HH:mm') + ' UTC' : 'PRESENT';
  const name = escapeHtml(s.location_name ?? s.country_code);
  const ctx = s.context ? `<dt>CONTEXT</dt><dd>${escapeHtml(s.context)}</dd>` : '';
  const exp = s.is_exposure_site ? `<dt>FLAG</dt><dd class="exposure">EXPOSURE SITE</dd>` : '';
  return `<div class="pathwatch-stop-tooltip">
    <div class="stop-num">STOP ${index} OF ${total}</div>
    <div class="stop-name">${name}</div>
    <dl>
      <dt>ARRIVED</dt><dd>${arrived}</dd>
      <dt>DEPARTED</dt><dd>${departed}</dd>
      ${ctx}
      ${exp}
    </dl>
  </div>`;
}

export function MapPanel({ countries, cases, caseLocations, selectedCaseId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const rafRef = useRef<number>(0);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const iso2ToBucket = useMemo(() => {
    const m = new Map<string, ReturnType<typeof countryBucket>>();
    for (const c of countries) m.set(c.country_code, countryBucket(c));
    return m;
  }, [countries]);

  const caseMarkers = useMemo(() => {
    return cases
      .map((c) => {
        const loc = currentLocation(caseLocationsFor(c.id, caseLocations));
        if (!loc?.latitude || !loc?.longitude) return null;
        return { case: c, lat: loc.latitude, lon: loc.longitude };
      })
      .filter((x): x is { case: Case; lat: number; lon: number } => x !== null);
  }, [cases, caseLocations]);

  // Mount map + deck.gl overlay once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_STYLE,
      center: [20, 10],
      zoom: 1.5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on('load', async () => {
      const geo = await fetch('/world.geo.json').then((r) => r.json());
      for (const f of geo.features) {
        const iso2 = f.properties?.ISO_A2 ?? f.properties?.ISO_A2_EH;
        f.properties.bucket = iso2 ? (iso2ToBucket.get(iso2) ?? 'none') : 'none';
        f.properties.iso2 = iso2;
      }
      map.addSource('countries', { type: 'geojson', data: geo });
      map.addLayer({
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': [
            'match',
            ['get', 'bucket'],
            'low', BUCKET_COLOR.low,
            'mid', BUCKET_COLOR.mid,
            'high', BUCKET_COLOR.high,
            'monitoring', BUCKET_COLOR.monitoring,
            BUCKET_COLOR.none,
          ],
          'fill-opacity': [
            'match',
            ['get', 'bucket'],
            'monitoring', 0.55,
            0.45,
          ],
        },
      });
      map.on('click', 'countries-fill', (e) => {
        const iso2 = e.features?.[0]?.properties?.iso2 as string | undefined;
        if (!iso2) return;
        const u = new URLSearchParams(searchParams.toString());
        u.delete('case');
        u.set('country', iso2);
        router.replace(`${pathname}?${u.toString()}`, { scroll: false });
      });
      map.on('mouseenter', 'countries-fill', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'countries-fill', () => (map.getCanvas().style.cursor = ''));
    });

    // deck.gl overlay (rendered above all map layers)
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay as unknown as maplibregl.IControl);
    overlayRef.current = overlay;

    return () => {
      cancelAnimationFrame(rafRef.current);
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;
      try { overlay.finalize(); } catch { /* mid-teardown */ }
      overlayRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update choropleth on countries change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getSource('countries')) return;
    const src = map.getSource('countries') as GeoJSONSource;
    fetch('/world.geo.json')
      .then((r) => r.json())
      .then((geo) => {
        for (const f of geo.features) {
          const iso2 = f.properties?.ISO_A2 ?? f.properties?.ISO_A2_EH;
          f.properties.bucket = iso2 ? (iso2ToBucket.get(iso2) ?? 'none') : 'none';
          f.properties.iso2 = iso2;
        }
        src.setData(geo);
      });
  }, [iso2ToBucket]);

  // Render case markers (declarative replace)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: maplibregl.Marker[] = [];

    const attach = () => {
      for (const m of caseMarkers) {
        const el = document.createElement('div');
        const isSelected = selectedCaseId === m.case.id;
        const isMonitoring = m.case.status === 'monitoring';
        const color = STATUS_COLOR[m.case.status];
        const size = isSelected ? 18 : isMonitoring ? 9 : 12;
        const pulse =
          m.case.status === 'critical' || isSelected ? 'animation:pathwatchPulse 1.6s infinite;' : '';
        const indexBorder = m.case.is_index_case ? 'border:1px solid #d6dae6;' : '';
        // Monitoring markers: hollow dashed ring, no halo — visually subordinate to active cases.
        const fill = isMonitoring ? 'transparent' : color;
        const border = isMonitoring ? `border:1.5px dashed ${color};` : indexBorder;
        const halo = isMonitoring
          ? ''
          : `box-shadow:0 0 0 ${isSelected ? '5' : '3'}px ${color}33;`;
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${fill};${halo}cursor:pointer;${pulse}${border}`;
        el.title = `${caseLabel(m.case)} · ${m.case.status.toUpperCase()}`;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([m.lon, m.lat])
          .addTo(map);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const u = new URLSearchParams(searchParams.toString());
          u.delete('country');
          u.set('case', m.case.case_code);
          router.replace(`${pathname}?${u.toString()}`, { scroll: false });
        });
        markers.push(marker);
      }
    };

    if (map.loaded()) attach();
    else map.once('load', attach);

    return () => markers.forEach((mk) => mk.remove());
  }, [caseMarkers, selectedCaseId, pathname, router, searchParams]);

  // Animated travel path (deck.gl) for selected case
  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) return;

    cancelAnimationFrame(rafRef.current);
    hoverPopupRef.current?.remove();
    hoverPopupRef.current = null;

    if (!selectedCaseId) {
      overlay.setProps({ layers: [] });
      return;
    }

    const sel = cases.find((c) => c.id === selectedCaseId);
    if (!sel) {
      overlay.setProps({ layers: [] });
      return;
    }

    const stops = caseLocationsFor(sel.id, caseLocations).filter(
      (l) => l.latitude != null && l.longitude != null,
    );
    if (stops.length === 0) {
      overlay.setProps({ layers: [] });
      return;
    }

    // Auto-fit camera to the selected case's path so the trace is on screen.
    if (stops.length === 1) {
      map.flyTo({
        center: [stops[0].longitude as number, stops[0].latitude as number],
        zoom: 4,
        duration: 700,
      });
    } else {
      const bounds = new maplibregl.LngLatBounds(
        [stops[0].longitude as number, stops[0].latitude as number],
        [stops[0].longitude as number, stops[0].latitude as number],
      );
      for (const s of stops) {
        bounds.extend([s.longitude as number, s.latitude as number]);
      }
      // Right padding accounts for the inline DossierDrawer (~420px).
      map.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 460 },
        maxZoom: 6,
        duration: 700,
      });
    }

    const rgb = statusRgb(sel.status);
    // Path encoded as [lon, lat, t]; we use stop-index as the time axis.
    const path: [number, number, number][] = stops.map(
      (s, i) => [s.longitude as number, s.latitude as number, i],
    );
    const tMax = Math.max(0, stops.length - 1);
    const loopBuffer = 1.5; // pause-at-end before restart, in path-time units
    const loopLength = tMax + loopBuffer;
    const trailLength = Math.max(0.6, tMax * 0.55);
    // Real-time pacing: total animation duration scales with stop count.
    const durationMs = Math.max(1800, stops.length * 900);

    const onHover = (info: { object?: CaseLocation | null }): void => {
      const stop = info.object ?? null;
      if (!stop) {
        hoverPopupRef.current?.remove();
        hoverPopupRef.current = null;
        map.getCanvas().style.cursor = '';
        return;
      }
      map.getCanvas().style.cursor = 'pointer';
      const idx = stops.findIndex((s) => s.id === stop.id);
      const html = stopTooltipHTML(stop, idx + 1, stops.length);
      const popup =
        hoverPopupRef.current ??
        new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'pathwatch-popup pathwatch-stop-popup',
          offset: 14,
          maxWidth: 'min(360px, 92vw)',
        });
      hoverPopupRef.current = popup;
      popup.setLngLat([stop.longitude as number, stop.latitude as number]).setHTML(html).addTo(map);
    };

    let startTs: number | null = null;
    const tick = (ts: number) => {
      if (startTs === null) startTs = ts;
      // Loop the elapsed time over (durationMs + a 1.2s pause) so the trail clears,
      // then re-draws on the next iteration.
      const cyclePeriodMs = durationMs + 1200;
      const cyclePos = (ts - startTs) % cyclePeriodMs;
      // Map cycle position (0..duration) to path-time (0..loopLength).
      const tPath = Math.min(loopLength, (cyclePos / durationMs) * loopLength);

      overlay.setProps({
        layers: [
          // Static base path: full route always visible at low opacity
          new PathLayer<{ path: [number, number][] }>({
            id: 'travel-path-static',
            data: [{ path: path.map((p) => [p[0], p[1]] as [number, number]) }],
            getPath: (d) => d.path,
            getColor: [...(rgb as [number, number, number]), 90] as [number, number, number, number],
            getWidth: 2,
            widthUnits: 'pixels',
            widthMinPixels: 1.5,
            jointRounded: true,
            capRounded: true,
          }),
          // Animated trail: bright leading-edge pulse that loops over the static path
          new TripsLayer({
            id: 'travel-trail',
            data: [{ path }],
            getPath: (d: { path: [number, number, number][] }) =>
              d.path.map((p) => [p[0], p[1]] as [number, number]),
            getTimestamps: (d: { path: [number, number, number][] }) =>
              d.path.map((p) => p[2]),
            getColor: rgb as [number, number, number],
            opacity: 0.95,
            widthMinPixels: 2.5,
            jointRounded: true,
            capRounded: true,
            fadeTrail: true,
            trailLength,
            currentTime: tPath,
          }),
          new ScatterplotLayer<CaseLocation>({
            id: 'travel-stops',
            data: stops,
            getPosition: (d) => [d.longitude as number, d.latitude as number],
            getRadius: 7,
            radiusUnits: 'pixels',
            radiusMinPixels: 5,
            radiusMaxPixels: 9,
            getFillColor: [...(rgb as [number, number, number]), 235] as [number, number, number, number],
            getLineColor: [11, 13, 19, 255],
            lineWidthMinPixels: 2,
            stroked: true,
            pickable: true,
            onHover,
          }),
        ],
      });

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;
      try {
        overlay.setProps({ layers: [] });
      } catch {
        /* mid-teardown */
      }
    };
  }, [selectedCaseId, cases, caseLocations]);

  return <div ref={containerRef} className="h-full w-full" />;
}
