'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { ATCPosition } from '@/lib/types';

interface AirportInfo {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  country: string;
}

interface HistoricalAirport {
  icao: string;
  lat: number;
  lon: number;
}

interface LiveMapProps {
  onAirportClick: (icao: string, positions: ATCPosition[]) => void;
  onCountUpdate?: (count: number) => void;
  vatsimEnabled: boolean;
  ivaoEnabled: boolean;
}

// Approximates a geographic circle as a GeoJSON polygon ring.
// radiusNm in nautical miles (1nm ≈ 1/60 degree latitude).
const createCircleCoords = (center: [number, number], radiusNm: number, steps = 64): number[][] => {
  const radiusDeg = radiusNm / 60;
  const lonCorrection = Math.cos((center[1] * Math.PI) / 180);
  const coords: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    coords.push([
      center[0] + (radiusDeg / lonCorrection) * Math.sin(angle),
      center[1] + radiusDeg * Math.cos(angle),
    ]);
  }
  return coords;
};

const createDiamondImage = (color: string, size: number = 20) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size, size / 2);
  ctx.lineTo(size / 2, size);
  ctx.lineTo(0, size / 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
};

export function LiveMap({ onAirportClick, onCountUpdate, vatsimEnabled, ivaoEnabled }: LiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  const onAirportClickRef = useRef(onAirportClick);
  const onCountUpdateRef = useRef(onCountUpdate);
  const dataRef = useRef<ATCPosition[]>([]);
  const prevIcaosRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);
  const animFrameRef = useRef<number>(0);

  const [data, setData] = useState<ATCPosition[]>([]);
  const [airports, setAirports] = useState<Record<string, AirportInfo>>({});
  const [historicalAirports, setHistoricalAirports] = useState<HistoricalAirport[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => { onAirportClickRef.current = onAirportClick; }, [onAirportClick]);
  useEffect(() => { onCountUpdateRef.current = onCountUpdate; }, [onCountUpdate]);
  useEffect(() => { dataRef.current = data; }, [data]);

  // Initialize Map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [10, 45],
      zoom: 3,
      attributionControl: false,
    });

    m.addControl(new maplibregl.NavigationControl(), 'bottom-left');

    m.on('load', () => {
      m.addImage('diamond-green', createDiamondImage('#22c55e'));
      m.addImage('diamond-amber', createDiamondImage('#f59e0b'));
      m.addImage('diamond-gray', createDiamondImage('#6b7280'));

      m.addSource('coverage-areas', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      m.addSource('historical-airports', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      m.addSource('airports', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      m.addSource('new-arrivals', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Coverage circles below all markers
      m.addLayer({
        id: 'coverage-fill',
        type: 'fill',
        source: 'coverage-areas',
        paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.08 }
      });

      m.addLayer({
        id: 'coverage-line',
        type: 'line',
        source: 'coverage-areas',
        paint: { 'line-color': '#22c55e', 'line-opacity': 0.4, 'line-width': 1 }
      });

      m.addLayer({
        id: 'historical-diamonds',
        type: 'symbol',
        source: 'historical-airports',
        layout: {
          'icon-image': 'diamond-gray',
          'icon-size': 0.7,
          'icon-allow-overlap': false,
        }
      });

      m.addLayer({
        id: 'airport-diamonds',
        type: 'symbol',
        source: 'airports',
        layout: {
          'icon-image': [
            'case',
            ['==', ['get', 'hasHighCoverage'], true], 'diamond-green',
            'diamond-amber'
          ],
          'icon-size': 1,
          'icon-allow-overlap': true,
        }
      });

      // Pulse ring for new arrivals — rendered above markers
      m.addLayer({
        id: 'new-arrivals-ring',
        type: 'circle',
        source: 'new-arrivals',
        paint: {
          'circle-radius': 8,
          'circle-color': 'transparent',
          'circle-stroke-color': '#22c55e',
          'circle-stroke-width': 2,
          'circle-opacity': 0,
        }
      });

      m.addLayer({
        id: 'airport-labels',
        type: 'symbol',
        source: 'airports',
        minzoom: 7,
        layout: {
          'text-field': ['get', 'icao'],
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1,
        }
      });

      m.addLayer({
        id: 'historical-labels',
        type: 'symbol',
        source: 'historical-airports',
        minzoom: 8,
        layout: {
          'text-field': ['get', 'icao'],
          'text-size': 9,
          'text-offset': [0, 1.0],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#9ca3af',
          'text-halo-color': '#000000',
          'text-halo-width': 1,
        }
      });

      m.on('click', 'airport-diamonds', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const icao = feature.properties?.icao;
        const positions = dataRef.current.filter(p => p.icao === icao);
        onAirportClickRef.current(icao, positions);
      });

      m.on('click', 'historical-diamonds', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        onAirportClickRef.current(feature.properties?.icao, []);
      });

      m.on('mouseenter', 'airport-diamonds', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'airport-diamonds', () => { m.getCanvas().style.cursor = ''; });
      m.on('mouseenter', 'historical-diamonds', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'historical-diamonds', () => { m.getCanvas().style.cursor = ''; });
    });

    map.current = m;

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      m.remove();
    };
  }, []);

  // Fetch airport metadata once
  useEffect(() => {
    fetch('/api/airports')
      .then(r => r.json())
      .then(json => setAirports(json))
      .catch(err => console.error('[LiveMap] Failed to load airports:', err));
  }, []);

  // Fetch historical airports once
  useEffect(() => {
    fetch('/api/airports/historical')
      .then(r => r.json())
      .then(json => setHistoricalAirports(json.airports || []))
      .catch(err => console.error('[LiveMap] Failed to load historical airports:', err));
  }, []);

  // Polling Logic
  const fetchData = useCallback(async () => {
    setIsUpdating(true);
    try {
      const res = await fetch('/api/live');
      const json = await res.json();
      setData(json.positions || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('[LiveMap] Fetch failed:', err);
    } finally {
      setIsUpdating(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Update active airports + coverage areas sources
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !map.current.getSource('airports')) return;

    const filteredPositions = data.filter(p =>
      (p.network === 'VATSIM' && vatsimEnabled) ||
      (p.network === 'IVAO' && ivaoEnabled)
    );

    onCountUpdateRef.current?.(filteredPositions.length);

    const groups: Record<string, { icao: string, lat: number, lon: number, hasHighCoverage: boolean }> = {};

    filteredPositions.forEach(pos => {
      if (!groups[pos.icao]) {
        const airport = airports[pos.icao];
        let lat = airport?.lat;
        let lon = airport?.lon;
        if ((lat === undefined || lon === undefined) && pos.latitude && pos.longitude) {
          lat = pos.latitude;
          lon = pos.longitude;
        }
        if (lat !== undefined && lon !== undefined) {
          groups[pos.icao] = { icao: pos.icao, lat, lon, hasHighCoverage: false };
        }
      }
      if (groups[pos.icao] && ['TWR', 'APP', 'CTR', 'FSS'].includes(pos.positionType)) {
        groups[pos.icao].hasHighCoverage = true;
      }
    });

    const features = Object.values(groups).map(g => ({
      type: 'Feature',
      properties: { icao: g.icao, hasHighCoverage: g.hasHighCoverage },
      geometry: { type: 'Point', coordinates: [g.lon, g.lat] }
    }));

    (map.current.getSource('airports') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: features as any
    });

    // Coverage circles for APP/DEP
    const seenCoverage = new Set<string>();
    const coverageFeatures: any[] = [];
    filteredPositions.forEach(pos => {
      if (!['APP', 'DEP'].includes(pos.positionType)) return;
      if (seenCoverage.has(pos.icao)) return;
      seenCoverage.add(pos.icao);
      const airport = airports[pos.icao];
      const lat = airport?.lat ?? pos.latitude;
      const lon = airport?.lon ?? pos.longitude;
      if (lat === undefined || lon === undefined) return;
      coverageFeatures.push({
        type: 'Feature',
        properties: { icao: pos.icao },
        geometry: { type: 'Polygon', coordinates: [createCircleCoords([lon, lat], pos.visualRange ?? 50)] },
      });
    });

    if (map.current.getSource('coverage-areas')) {
      (map.current.getSource('coverage-areas') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: coverageFeatures,
      });
    }

    // Pulse animation for newly detected airports
    const currentIcaos = Object.keys(groups);
    if (!isFirstLoadRef.current) {
      const newIcaos = currentIcaos.filter(icao => !prevIcaosRef.current.has(icao));
      if (newIcaos.length > 0 && map.current.getSource('new-arrivals')) {
        const newFeatures = newIcaos
          .map(icao => groups[icao])
          .filter(Boolean)
          .map(g => ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [g.lon, g.lat] },
          }));

        const arrivalSource = map.current.getSource('new-arrivals') as maplibregl.GeoJSONSource;
        arrivalSource.setData({ type: 'FeatureCollection', features: newFeatures as any });

        cancelAnimationFrame(animFrameRef.current);
        const startTime = performance.now();
        const animate = (now: number) => {
          if (!map.current) return;
          const progress = Math.min((now - startTime) / 2000, 1);
          map.current.setPaintProperty('new-arrivals-ring', 'circle-radius', 8 + progress * 40);
          map.current.setPaintProperty('new-arrivals-ring', 'circle-opacity', 0.5 * (1 - progress));
          if (progress < 1) {
            animFrameRef.current = requestAnimationFrame(animate);
          } else {
            arrivalSource.setData({ type: 'FeatureCollection', features: [] });
          }
        };
        animFrameRef.current = requestAnimationFrame(animate);
      }
    }
    isFirstLoadRef.current = false;
    prevIcaosRef.current = new Set(currentIcaos);

  }, [data, airports, vatsimEnabled, ivaoEnabled]);

  // Update historical airports source
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !map.current.getSource('historical-airports')) return;
    const features = historicalAirports.map(a => ({
      type: 'Feature',
      properties: { icao: a.icao },
      geometry: { type: 'Point', coordinates: [a.lon, a.lat] }
    }));
    (map.current.getSource('historical-airports') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: features as any
    });
  }, [historicalAirports]);

  return (
    <div className="relative w-full h-full bg-background">
      <div ref={mapContainer} className="w-full h-full" />

      {isUpdating && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-background text-[10px] font-bold tracking-tighter uppercase rounded-lg border border-border/50 shadow-sm animate-pulse z-10">
          Updating Live Data...
        </div>
      )}

      <div className="hidden sm:block absolute bottom-4 right-4 px-2 py-1 bg-background text-[9px] text-muted-foreground font-mono rounded-lg border border-border/50 pointer-events-none z-10">
        LAST SYNC: {lastUpdate?.toLocaleTimeString() || 'WAITING...'}
      </div>
    </div>
  );
}
