'use client';
import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { type Map as MlMap, type GeoJSONSource } from 'maplibre-gl';
import { createRoot, type Root } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CountryStat, Event } from '@/lib/types';
import { caseBucket, BUCKET_COLOR, markerSizePx } from '@/lib/map-colors';
import { CountryTooltip } from './CountryTooltip';
import { EventTooltip } from './EventTooltip';

const TILE_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface Props {
  countries: CountryStat[];
  events: Event[];
}

export function MapPanel({ countries, events }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRootsRef = useRef<Root[]>([]);

  // ISO_A2 → bucket lookup for the choropleth
  const iso2ToBucket = useMemo(() => {
    const m = new Map<string, ReturnType<typeof caseBucket>>();
    for (const c of countries) m.set(c.country_code, caseBucket(c.cases));
    return m;
  }, [countries]);

  // ISO_A2 → CountryStat for tooltip lookup
  const iso2ToCountry = useMemo(() => {
    const m = new Map<string, CountryStat>();
    for (const c of countries) m.set(c.country_code, c);
    return m;
  }, [countries]);

  const recentEvents = useMemo(() => {
    const cutoff = Date.now() - ONE_DAY_MS;
    return events.filter(
      (e) =>
        e.latitude != null &&
        e.longitude != null &&
        new Date(e.occurred_at ?? e.created_at).getTime() >= cutoff,
    );
  }, [events]);

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
          'fill-opacity': 0.55,
        },
      });

      map.on('click', 'countries-fill', (e) => {
        const f = e.features?.[0];
        const iso2 = f?.properties?.iso2 as string | undefined;
        const country = iso2 ? iso2ToCountry.get(iso2) : undefined;
        if (!country) return;
        const el = document.createElement('div');
        const root = createRoot(el);
        popupRootsRef.current.push(root);
        root.render(<CountryTooltip country={country} />);
        new maplibregl.Popup({ closeButton: true, className: 'pathwatch-popup' })
          .setLngLat(e.lngLat)
          .setDOMContent(el)
          .addTo(map);
      });

      map.on('mouseenter', 'countries-fill', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'countries-fill', () => (map.getCanvas().style.cursor = ''));
    });

    return () => {
      popupRootsRef.current.forEach((r) => r.unmount());
      popupRootsRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update choropleth when countries change
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

  // Render markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: maplibregl.Marker[] = [];

    const attach = () => {
      for (const ev of recentEvents) {
        const el = document.createElement('div');
        el.className = 'pathwatch-marker';
        const size = markerSizePx(ev.significance);
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${BUCKET_COLOR.high};box-shadow:0 0 0 3px ${BUCKET_COLOR.high}33;animation:pathwatchPulse 2s infinite;cursor:pointer;`;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([ev.longitude!, ev.latitude!])
          .addTo(map);
        el.addEventListener('click', () => {
          const popupEl = document.createElement('div');
          const root = createRoot(popupEl);
          popupRootsRef.current.push(root);
          root.render(<EventTooltip event={ev} />);
          new maplibregl.Popup({ closeButton: true, className: 'pathwatch-popup' })
            .setLngLat([ev.longitude!, ev.latitude!])
            .setDOMContent(popupEl)
            .addTo(map);
        });
        markers.push(marker);
      }
    };

    if (map.loaded()) attach();
    else map.once('load', attach);

    return () => markers.forEach((m) => m.remove());
  }, [recentEvents]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div ref={containerRef} className="h-[280px] w-full" />
    </div>
  );
}
