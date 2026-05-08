'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import maplibregl, { type Map as MlMap, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CountryStat, Case, CaseLocation } from '@/lib/types';
import { caseBucket, BUCKET_COLOR } from '@/lib/map-colors';
import { STATUS_COLOR, caseLocationsFor, currentLocation } from '@/lib/case-helpers';

const TILE_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface Props {
  countries: CountryStat[];
  cases: Case[];
  caseLocations: CaseLocation[];
  selectedCaseId?: string | null;
}

export function MapPanel({ countries, cases, caseLocations, selectedCaseId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const iso2ToBucket = useMemo(() => {
    const m = new Map<string, ReturnType<typeof caseBucket>>();
    for (const c of countries) m.set(c.country_code, caseBucket(c.cases));
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

  // Mount map once
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
            BUCKET_COLOR.none,
          ],
          'fill-opacity': 0.45,
        },
      });
      map.on('click', 'countries-fill', (e) => {
        const iso2 = e.features?.[0]?.properties?.iso2 as string | undefined;
        if (!iso2) return;
        const u = new URLSearchParams(searchParams.toString());
        u.delete('case');
        u.set('country', iso2);
        router.replace(`${pathname}?${u.toString()}`);
      });
      map.on('mouseenter', 'countries-fill', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'countries-fill', () => (map.getCanvas().style.cursor = ''));
    });

    return () => {
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
        const color = STATUS_COLOR[m.case.status];
        const size = isSelected ? 18 : 12;
        const pulse =
          m.case.status === 'critical' || isSelected ? 'animation:pathwatchPulse 1.6s infinite;' : '';
        const indexBorder = m.case.is_index_case ? 'border:1px solid #d6dae6;' : '';
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};box-shadow:0 0 0 ${
          isSelected ? '5' : '3'
        }px ${color}33;cursor:pointer;${pulse}${indexBorder}`;
        el.title = `${m.case.case_code} · ${m.case.status.toUpperCase()}`;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([m.lon, m.lat])
          .addTo(map);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const u = new URLSearchParams(searchParams.toString());
          u.delete('country');
          u.set('case', m.case.case_code);
          router.replace(`${pathname}?${u.toString()}`);
        });
        markers.push(marker);
      }
    };

    if (map.loaded()) attach();
    else map.once('load', attach);

    return () => markers.forEach((mk) => mk.remove());
  }, [caseMarkers, selectedCaseId, pathname, router, searchParams]);

  // Travel path for selected case
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const SOURCE_ID = 'pathwatch-travel-path';
    const LINE_LAYER_ID = 'pathwatch-travel-path-line';
    const POINTS_LAYER_ID = 'pathwatch-travel-path-points';

    const cleanup = () => {
      if (!map) return;
      try {
        if (map.getLayer(POINTS_LAYER_ID)) map.removeLayer(POINTS_LAYER_ID);
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        // map mid-teardown; ignore
      }
    };

    if (!selectedCaseId) {
      if (map.isStyleLoaded()) cleanup();
      return cleanup;
    }

    const sel = cases.find((c) => c.id === selectedCaseId);
    if (!sel) return cleanup;
    const stops = caseLocationsFor(sel.id, caseLocations).filter(
      (l) => l.latitude != null && l.longitude != null,
    );
    if (stops.length < 1) return cleanup;
    const color = STATUS_COLOR[sel.status];
    const lineCoords = stops.map((s) => [s.longitude as number, s.latitude as number]);
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: lineCoords },
          properties: {},
        },
        ...stops.map((s, i) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [s.longitude as number, s.latitude as number] },
          properties: { stop: i + 1 },
        })),
      ],
    };
    const apply = () => {
      cleanup();
      map.addSource(SOURCE_ID, { type: 'geojson', data: fc });
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': color,
          'line-width': 2,
          'line-dasharray': [3, 2],
          'line-opacity': 0.9,
        },
      });
      map.addLayer({
        id: POINTS_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 5,
          'circle-color': color,
          'circle-stroke-color': '#0b0d13',
          'circle-stroke-width': 2,
        },
      });
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);

    return cleanup;
  }, [selectedCaseId, cases, caseLocations]);

  return <div ref={containerRef} className="h-full w-full" />;
}
