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

interface LiveMapProps {
  onAirportClick: (icao: string, positions: ATCPosition[]) => void;
  vatsimEnabled: boolean;
  ivaoEnabled: boolean;
}

export function LiveMap({ onAirportClick, vatsimEnabled, ivaoEnabled }: LiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  // Refs to avoid stale closures in map event handlers
  const onAirportClickRef = useRef(onAirportClick);
  const dataRef = useRef<ATCPosition[]>([]);

  const [data, setData] = useState<ATCPosition[]>([]);
  const [airports, setAirports] = useState<Record<string, AirportInfo>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    onAirportClickRef.current = onAirportClick;
  }, [onAirportClick]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

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
      // Add source for airports
      m.addSource('airports', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Add layer for circles
      m.addLayer({
        id: 'airport-circles',
        type: 'circle',
        source: 'airports',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            2, 4,
            6, 10
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': ['get', 'strokeWidth'],
          'circle-stroke-color': ['get', 'strokeColor'],
          'circle-opacity': 0.9
        }
      });

      // Click handler
      m.on('click', 'airport-circles', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;

        const icao = feature.properties?.icao;
        const positions = dataRef.current.filter(p => p.icao === icao);
        onAirportClickRef.current(icao, positions);
      });

      // Hover cursors
      m.on('mouseenter', 'airport-circles', () => {
        m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', 'airport-circles', () => {
        m.getCanvas().style.cursor = '';
      });
    });

    map.current = m;

    return () => {
      m.remove();
    };
  }, []);

  // Fetch Airports once
  useEffect(() => {
    const fetchAirports = async () => {
      try {
        const res = await fetch('/api/airports');
        const json = await res.json();
        setAirports(json);
      } catch (err) {
        console.error('[LiveMap] Failed to load airports:', err);
      }
    };
    fetchAirports();
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
    const poll = () => fetchData();
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Update Map Source Data
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !map.current.getSource('airports')) return;

    const filteredPositions = data.filter(p =>
      (p.network === 'VATSIM' && vatsimEnabled) ||
      (p.network === 'IVAO' && ivaoEnabled)
    );

    // Group by ICAO
    const groups: Record<string, { icao: string, lat: number, lon: number, status: string, networks: string[] }> = {};

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
          groups[pos.icao] = {
            icao: pos.icao,
            lat,
            lon,
            status: 'partial',
            networks: []
          };
        }
      }

      if (groups[pos.icao]) {
        if (!groups[pos.icao].networks.includes(pos.network)) {
          groups[pos.icao].networks.push(pos.network);
        }
        if (['TWR', 'APP', 'CTR'].includes(pos.positionType)) {
          groups[pos.icao].status = 'active';
        }
      }
    });

    // Convert to GeoJSON
    const features = Object.values(groups).map(g => {
      const color = g.status === 'active' ? '#1D9E75' : '#EF9F27';
      const bothNets = g.networks.length > 1;

      return {
        type: 'Feature',
        properties: {
          icao: g.icao,
          color,
          strokeWidth: bothNets ? 3 : 1,
          strokeColor: bothNets ? '#FFFFFF' : 'rgba(0,0,0,0.3)'
        },
        geometry: {
          type: 'Point',
          coordinates: [g.lon, g.lat]
        }
      };
    });

    (map.current.getSource('airports') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: features as any
    });

  }, [data, airports, vatsimEnabled, ivaoEnabled]);

  return (
    <div className="relative w-full h-full bg-background">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Loading Indicator */}
      {isUpdating && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-background text-[10px] font-bold tracking-tighter uppercase rounded-lg border border-border/50 shadow-sm animate-pulse z-10">
          Updating Live Data...
        </div>
      )}

      {/* Last Update Overlay */}
      <div className="absolute bottom-4 right-4 px-2 py-1 bg-background text-[9px] text-muted-foreground font-mono rounded-lg border border-border/50 pointer-events-none z-10">
        LAST SYNC: {lastUpdate?.toLocaleTimeString() || 'WAITING...'}
      </div>
    </div>
  );
}
