'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { LiveMap } from './LiveMap';
import { AirportPanel } from './AirportPanel';
import { ATCPosition } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PlaneTakeoff, Sun, Moon } from 'lucide-react';
import StatsModal from './StatsModal';

export default function HomeContainer() {
  const [vatsimEnabled, setVatsimEnabled] = useState(true);
  const [ivaoEnabled, setIvaoEnabled] = useState(true);
  const [selectedAirport, setSelectedAirport] = useState<{ icao: string; positions: ATCPosition[] } | null>(null);
  const [statsIcao, setStatsIcao] = useState<string | null>(null);
  const [controllerCount, setControllerCount] = useState(0);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const dark = stored !== null ? stored === 'dark' : true;
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  };

  const handleAirportClick = useCallback((icao: string, positions: ATCPosition[]) => {
    setSelectedAirport({ icao, positions });
  }, []);

  const handleCountUpdate = useCallback((count: number) => {
    setControllerCount(count);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="h-12 border-b border-border/50 bg-background flex items-center justify-between px-4 z-20 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/20">
            <PlaneTakeoff className="text-primary-foreground w-4 h-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tighter">ATC MONITOR</span>
            <span className="text-[9px] font-semibold text-muted-foreground tracking-widest uppercase hidden sm:block">
              Live Coverage
            </span>
          </div>
        </div>

        {/* Desktop controls */}
        <div className="hidden md:flex items-center gap-5">
          {/* Live counter */}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-bold tabular-nums">{controllerCount}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">online</span>
          </div>

          <div className="h-5 w-px bg-border/50" />

          {/* Network toggles */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Switch id="vatsim-mode" checked={vatsimEnabled} onCheckedChange={setVatsimEnabled} />
              <Label htmlFor="vatsim-mode" className="text-xs font-bold cursor-pointer">VATSIM</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch id="ivao-mode" checked={ivaoEnabled} onCheckedChange={setIvaoEnabled} />
              <Label htmlFor="ivao-mode" className="text-xs font-bold cursor-pointer">IVAO</Label>
            </div>
          </div>

          <div className="h-5 w-px bg-border/50" />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Mobile: counter + theme toggle */}
        <div className="flex md:hidden items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-bold tabular-nums">{controllerCount}</span>
          </div>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Map */}
      <main className="flex-1 relative overflow-hidden">
        <LiveMap
          vatsimEnabled={vatsimEnabled}
          ivaoEnabled={ivaoEnabled}
          onAirportClick={handleAirportClick}
          onCountUpdate={handleCountUpdate}
        />

        {/* Mobile network filter pill */}
        <div className="md:hidden absolute bottom-6 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2 shadow-2xl flex items-center gap-4 z-10">
          <div className="flex items-center gap-1.5 border-r border-border/50 pr-4">
            <Switch checked={vatsimEnabled} onCheckedChange={setVatsimEnabled} />
            <span className="text-[10px] font-bold">VATSIM</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch checked={ivaoEnabled} onCheckedChange={setIvaoEnabled} />
            <span className="text-[10px] font-bold">IVAO</span>
          </div>
        </div>

        <footer className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <p className="text-[10px] text-gray-500 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border/30 whitespace-nowrap">
            Not affiliated with VATSIM or IVAO · Data sourced from public feeds · For flight simulation use only
          </p>
        </footer>
      </main>

      <AirportPanel
        icao={selectedAirport?.icao || null}
        positions={selectedAirport?.positions || []}
        onClose={() => setSelectedAirport(null)}
        onShowStats={(icao) => setStatsIcao(icao)}
      />

      <StatsModal
        icao={statsIcao}
        onClose={() => setStatsIcao(null)}
      />
    </div>
  );
}
