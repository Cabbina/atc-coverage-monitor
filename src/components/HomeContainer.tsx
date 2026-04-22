'use client';

import React, { useState, useCallback } from 'react';
import { LiveMap } from './LiveMap';
import { AirportPanel } from './AirportPanel';
import { ATCPosition } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PlaneTakeoff } from 'lucide-react';

export default function HomeContainer() {
  const [vatsimEnabled, setVatsimEnabled] = useState(true);
  const [ivaoEnabled, setIvaoEnabled] = useState(true);
  const [selectedAirport, setSelectedAirport] = useState<{ icao: string; positions: ATCPosition[] } | null>(null);

  const handleAirportClick = useCallback((icao: string, positions: ATCPosition[]) => {
    setSelectedAirport({ icao, positions });
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="h-16 border-b border-border/50 bg-background flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <PlaneTakeoff className="text-primary-foreground w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tighter leading-none">ATC MONITOR</h1>
            <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase opacity-70">
              Live Coverage Tracker
            </span>
          </div>
        </div>

        {/* Global Stats & Controls */}
        <div className="hidden md:flex items-center gap-8">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Networks</span>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="vatsim-mode" 
                    checked={vatsimEnabled} 
                    onCheckedChange={setVatsimEnabled}
                  />
                  <Label htmlFor="vatsim-mode" className="text-xs font-bold cursor-pointer">VATSIM</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="ivao-mode" 
                    checked={ivaoEnabled} 
                    onCheckedChange={setIvaoEnabled}
                  />
                  <Label htmlFor="ivao-mode" className="text-xs font-bold cursor-pointer">IVAO</Label>
                </div>
              </div>
            </div>
            
            <div className="h-8 w-px bg-border/50" />

            <div className="flex gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-tighter">Live</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[10px] py-1">
            v0.1.0-alpha
          </Badge>
        </div>
      </header>

      {/* Main Map Content */}
      <main className="flex-1 relative">
        <LiveMap 
          vatsimEnabled={vatsimEnabled} 
          ivaoEnabled={ivaoEnabled} 
          onAirportClick={handleAirportClick} 
        />
        
        {/* Mobile Filter Overlay (optional) */}
        <div className="md:hidden absolute bottom-6 left-1/2 -translate-x-1/2 bg-background border border-border/50 rounded-full px-4 py-2 shadow-2xl flex items-center gap-4 z-10">
           <div className="flex items-center space-x-2 border-r border-border/50 pr-4">
              <Switch checked={vatsimEnabled} onCheckedChange={setVatsimEnabled} />
              <span className="text-[10px] font-bold">VAT</span>
           </div>
           <div className="flex items-center space-x-2">
              <Switch checked={ivaoEnabled} onCheckedChange={setIvaoEnabled} />
              <span className="text-[10px] font-bold">IVAO</span>
           </div>
        </div>
      </main>

      <AirportPanel 
        icao={selectedAirport?.icao || null} 
        positions={selectedAirport?.positions || []} 
        onClose={() => setSelectedAirport(null)} 
      />
    </div>
  );
}
