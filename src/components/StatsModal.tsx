'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Loader2, X } from 'lucide-react';

interface StatsModalProps {
  icao: string | null;
  onClose: () => void;
}

export default function StatsModal({ icao, onClose }: StatsModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ last24h: any[]; heatmap: any[] } | null>(null);

  useEffect(() => {
    if (!icao) return;
    setLoading(true);
    fetch(`/api/stats/${icao}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) {
          setData({ last24h: [], heatmap: [] })
        } else {
          setData(res)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [icao]);

  if (!icao) return null;

  console.log('[Stats] StatsModal render, icao:', icao);

  const renderLast24h = () => {
    if (!data || data.last24h.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground italic text-sm">
          Not enough data yet — check back after 24h of monitoring
        </div>
      );
    }

    // Transform data for AreaChart
    const chartDataMap: Record<string, any> = {};

    // Initialize 24 hours
    for (let i = 0; i < 24; i++) {
      const key = `${i.toString().padStart(2, '0')}:00z`;
      chartDataMap[key] = { name: key, VATSIM: 0, IVAO: 0 };
    }

    data.last24h.forEach((row) => {
      const hourNum = new Date(row.hour).getUTCHours();
      const key = `${hourNum.toString().padStart(2, '0')}:00z`;
      if (chartDataMap[key]) {
        chartDataMap[key][row.network] += parseInt(row.sessions);
      }
    });

    const chartData = Object.values(chartDataMap);

    return (
      <div className="mt-4" style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorVatsim" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorIvao" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
            <XAxis
              dataKey="name"
              stroke="#9ca3af"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval={3}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${val}`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
              itemStyle={{ fontSize: '12px' }}
            />
            <Area
              type="monotone"
              dataKey="VATSIM"
              stroke="#3b82f6"
              fillOpacity={1}
              fill="url(#colorVatsim)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="IVAO"
              stroke="#10b981"
              fillOpacity={1}
              fill="url(#colorIvao)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
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

    // Create grid data
    const grid: Record<string, number> = {};
    data.heatmap.forEach((row) => {
      const key = `${row.day_of_week}-${row.hour_utc}`;
      const ratio = row.covered_hours / row.total_weeks;
      grid[key] = (grid[key] || 0) + ratio;
    });

    return (
      <div className="mt-6 flex flex-col gap-1 overflow-x-auto pb-4">
        <div className="flex mb-1">
          <div className="w-10" />
          {hours.map((h) => (
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
            {hours.map((hour) => {
              const intensity = grid[`${dIdx}-${hour}`] || 0;
              const clampedIntensity = Math.min(intensity, 1);

              let bgColor = 'bg-gray-800/30';
              if (clampedIntensity > 0.8) bgColor = 'bg-emerald-500';
              else if (clampedIntensity > 0.5) bgColor = 'bg-emerald-600/80';
              else if (clampedIntensity > 0.2) bgColor = 'bg-emerald-700/60';
              else if (clampedIntensity > 0) bgColor = 'bg-emerald-900/40';

              return (
                <div
                  key={hour}
                  className={`flex-1 rounded-sm ${bgColor} transition-colors hover:ring-1 hover:ring-white/20`}
                  title={`${day} ${hour}z: ${Math.round(clampedIntensity * 100)}% coverage`}
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
        className={`relative mx-4 text-white shadow-2xl transition-all duration-300 transform flex flex-col gap-6 ${icao ? 'scale-100' : 'scale-95'}`}
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
        onClick={(e) => e.stopPropagation()}
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

          <div className="mt-4 min-h-[320px] flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <TabsContent value="24h" className="mt-0 outline-none">
                  <div className="text-sm text-muted-foreground mb-2">
                    Active ATC sessions per hour (Last 24 hours)
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
