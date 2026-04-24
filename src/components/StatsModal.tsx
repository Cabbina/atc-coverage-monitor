'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, X } from 'lucide-react';

const POSITION_TYPES = ['ALL', 'TWR', 'APP', 'CTR', 'GND', 'DEL'] as const;
type PositionTypeFilter = typeof POSITION_TYPES[number];

interface StatsModalProps {
  icao: string | null;
  onClose: () => void;
}

export default function StatsModal({ icao, onClose }: StatsModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ last24h: any[]; heatmap: any[] } | null>(null);
  const [positionType, setPositionType] = useState<PositionTypeFilter>('ALL');

  useEffect(() => {
    setPositionType('ALL');
  }, [icao]);

  useEffect(() => {
    if (!icao) return;
    setLoading(true);
    setData(null);
    fetch(`/api/stats/${icao}?position_type=${positionType}`)
      .then(r => r.json())
      .then(res => {
        setData(res.error ? { last24h: [], heatmap: [] } : res);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [icao, positionType]);

  if (!icao) return null;

  const renderLast24h = () => {
    if (!data || data.last24h.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground italic text-sm">
          Not enough data yet — check back after 24h of monitoring
        </div>
      );
    }

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const coveredVATSIM = new Set<number>();
    const coveredIVAO = new Set<number>();

    data.last24h.forEach(row => {
      const h = new Date(row.hour).getUTCHours();
      if (row.network === 'VATSIM') coveredVATSIM.add(h);
      if (row.network === 'IVAO') coveredIVAO.add(h);
    });

    return (
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex">
          <div className="w-16 shrink-0" />
          {hours.map(h => (
            <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground font-mono">
              {h % 6 === 0 ? `${h}z` : ''}
            </div>
          ))}
        </div>

        {(['VATSIM', 'IVAO'] as const).map(net => {
          const covered = net === 'VATSIM' ? coveredVATSIM : coveredIVAO;
          return (
            <div key={net} className="flex items-center">
              <div className={`w-16 text-[10px] font-mono shrink-0 ${net === 'VATSIM' ? 'text-blue-400' : 'text-emerald-400'}`}>
                {net}
              </div>
              {hours.map(h => (
                <div
                  key={h}
                  className={`flex-1 h-7 rounded-sm mx-px transition-colors ${covered.has(h) ? 'bg-emerald-500' : 'bg-gray-800/50'}`}
                  title={`${h.toString().padStart(2, '0')}z: ${covered.has(h) ? 'covered' : 'no coverage'}`}
                />
              ))}
            </div>
          );
        })}

        <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span>Covered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gray-800/50" />
            <span>No coverage</span>
          </div>
        </div>
      </div>
    );
  };

  const renderHeatmap = () => {
    if (!data || data.heatmap.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground italic text-sm">
          Not enough data yet
        </div>
      );
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const grid: Record<string, number> = {};
    data.heatmap.forEach(row => {
      const key = `${row.day_of_week}-${row.hour_utc}`;
      const ratio = row.covered_hours / row.total_weeks;
      grid[key] = (grid[key] || 0) + ratio;
    });

    return (
      <div className="mt-6 flex flex-col gap-1 overflow-x-auto pb-4">
        <div className="flex mb-1">
          <div className="w-10" />
          {hours.map(h => (
            <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground font-mono">
              {h % 4 === 0 ? h : ''}
            </div>
          ))}
        </div>
        {days.map((day, dIdx) => (
          <div key={day} className="flex gap-1 h-4">
            <div className="w-10 text-[10px] text-muted-foreground font-medium self-center">
              {day}
            </div>
            {hours.map(hour => {
              const intensity = Math.min(grid[`${dIdx}-${hour}`] || 0, 1);
              let bgColor = 'bg-gray-800/30';
              if (intensity > 0.8) bgColor = 'bg-emerald-500';
              else if (intensity > 0.5) bgColor = 'bg-emerald-600/80';
              else if (intensity > 0.2) bgColor = 'bg-emerald-700/60';
              else if (intensity > 0) bgColor = 'bg-emerald-900/40';

              return (
                <div
                  key={hour}
                  className={`flex-1 rounded-sm ${bgColor} transition-colors hover:ring-1 hover:ring-white/20`}
                  title={`${day} ${hour}z: ${Math.round(intensity * 100)}% coverage`}
                />
              );
            })}
          </div>
        ))}
        <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
          <span>0%</span>
          <div className="flex h-1.5 w-20 rounded-full bg-gradient-to-r from-gray-800 to-emerald-500" />
          <span>100%</span>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center transition-all duration-300 ${icao ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'}`}
      style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className={`relative mx-4 text-white shadow-2xl transition-all duration-300 transform flex flex-col gap-4 ${icao ? 'scale-100' : 'scale-95'}`}
        style={{
          backgroundColor: '#030712',
          border: '1px solid #1f2937',
          maxHeight: '90vh',
          overflowY: 'auto',
          width: '100%',
          maxWidth: '720px',
          borderRadius: '16px',
          padding: '24px'
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-3">
            <span style={{ backgroundColor: '#1e3a5f', color: '#60a5fa', border: '1px solid #2563eb', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '14px' }}>
              {icao}
            </span>
            <span style={{ color: '#f9fafb', fontSize: '20px', fontWeight: 'bold' }}>
              Coverage Statistics
            </span>
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {POSITION_TYPES.map(pt => (
            <button
              key={pt}
              onClick={() => setPositionType(pt)}
              className={`px-3 py-1 text-[11px] font-mono rounded-full border transition-colors ${
                positionType === pt
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              {pt}
            </button>
          ))}
        </div>

        <Tabs defaultValue="24h" className="w-full">
          <TabsList className="bg-gray-900 border-gray-800 w-full justify-start h-10 p-1 gap-4" variant="line">
            <TabsTrigger
              value="24h"
              className="text-gray-400 data-active:text-white data-active:border-b-2 data-active:border-blue-500 rounded-none bg-transparent"
            >
              Last 24h
            </TabsTrigger>
            <TabsTrigger
              value="heatmap"
              className="text-gray-400 data-active:text-white data-active:border-b-2 data-active:border-blue-500 rounded-none bg-transparent"
            >
              Weekly Heatmap
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 min-h-[280px] flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <TabsContent value="24h" className="mt-0 outline-none">
                  <div className="text-sm text-muted-foreground mb-2">
                    UTC hours with active ATC coverage (last 24h)
                  </div>
                  {renderLast24h()}
                </TabsContent>

                <TabsContent value="heatmap" className="mt-0 outline-none">
                  <div className="text-sm text-muted-foreground mb-2">
                    Historical coverage probability based on weekly patterns
                  </div>
                  {renderHeatmap()}
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
