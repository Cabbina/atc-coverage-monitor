'use client'; import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import React from 'react';
import { ATCPosition } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X } from 'lucide-react';

interface AirportPanelProps {
  icao: string | null;
  positions: ATCPosition[];
  onClose: () => void;
  onShowStats?: (icao: string) => void;
}

const POSITION_COLORS: Record<string, string> = {
  DEL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  GND: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  TWR: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  APP: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  DEP: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  CTR: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  FSS: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
  ATIS: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const POSITION_LABELS: Record<string, string> = {
  DEL: 'Delivery',
  GND: 'Ground',
  TWR: 'Tower',
  APP: 'Approach',
  DEP: 'Departure',
  CTR: 'Center/FIR',
  FSS: 'Flight Service',
  ATIS: 'ATIS',
};

function ATISAccordion({ atis, atisCode }: { atis: string | string[] | null | undefined, atisCode?: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="w-full">
      <button
        onClick={() => setOpen(o => !o)}
        className="py-1 text-xs font-bold text-muted-foreground w-full text-left flex items-center gap-1"
      >
        <span className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
        VIEW ATIS {atisCode ? `[${atisCode}]` : ''}
      </button>
      {open && (
        <div className="p-3 rounded-lg bg-muted/50 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap border border-border/50">
          {Array.isArray(atis) ? atis.join(' \n') : atis}
        </div>
      )}
    </div>
  )
}

export function AirportPanel({ icao, positions, onClose, onShowStats }: AirportPanelProps) {
  const { data: session } = useSession();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [network, setNetwork] = useState('ANY');
  const [positionType, setPositionType] = useState('ANY');
  const [trigger, setTrigger] = useState('both');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!icao || !session) return;
    fetch('/api/alerts')
      .then(r => r.json())
      .then(data => setAlerts(data.filter((a: any) => a.icao === icao)))
      .catch(() => { })
  }, [icao, session]);

  const createAlert = async () => {
    setSaving(true);
    await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icao, network, position_type: positionType, trigger }),
    });
    const data = await fetch('/api/alerts').then(r => r.json());
    setAlerts(data.filter((a: any) => a.icao === icao));
    setSaving(false);
  };

  const deleteAlert = async (id: number) => {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const vatsimPositions = positions.filter((p) => p.network === 'VATSIM');
  const ivaoPositions = positions.filter((p) => p.network === 'IVAO');

  const formatUptime = (p: ATCPosition) => {
    if (p.onlineSeconds) {
      const h = Math.floor(p.onlineSeconds / 3600);
      const m = Math.floor((p.onlineSeconds % 3600) / 60);
      return `${h}h${m}m`;
    }
    if (p.logonTime) {
      return new Date(p.logonTime).toISOString().slice(11, 16) + 'z';
    }
    return '—';
  };

  return (
    <div className={`fixed inset-0 z-50 transition-all duration-300 ${icao ? 'visible' : 'invisible pointer-events-none'}`}>
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${icao ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className={`absolute right-0 top-0 h-full w-full sm:max-w-md bg-background border-l border-border/50 shadow-2xl transition-transform duration-300 ease-in-out transform flex flex-col ${icao ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="p-6 pb-4 flex flex-col gap-4 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center justify-between gap-4 mr-8">
            <div className="flex flex-col">
              <h2 className="text-4xl font-bold tracking-tighter leading-tight">
                {icao}
              </h2>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                Airport ATC Coverage
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-1">
                {vatsimPositions.length > 0 && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                    VATSIM
                  </Badge>
                )}
                {ivaoPositions.length > 0 && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    IVAO
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] font-bold uppercase tracking-wider bg-primary/5 hover:bg-primary/10 border-primary/20"
                onClick={() => {
                  console.log('[Stats] onShowStats called with:', icao);
                  icao && onShowStats?.(icao);
                }}
              >
                View Statistics
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <ScrollArea className="flex-1 px-6">
          <div className="py-6 flex flex-col gap-6">
            {positions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground italic text-sm">
                No active ATC coverage at the moment.
              </div>
            ) : (
              positions
                .sort((a, b) => a.positionType.localeCompare(b.positionType))
                .map((p, idx) => (
                  <div key={`${p.network}-${p.callsign}-${idx}`} className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <Badge
                          className={`w-fit font-bold ${POSITION_COLORS[p.positionType] || 'bg-secondary'
                            }`}
                        >
                          {POSITION_LABELS[p.positionType] || p.positionType}
                        </Badge>
                        <span className="font-mono text-sm font-bold tracking-tight">
                          {p.callsign}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-right">
                        <span className="text-sm font-semibold">{p.frequency} MHz</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          Online since: {formatUptime(p)}
                        </span>
                      </div>
                    </div>

                    {p.atis && (
                      <ATISAccordion atis={p.atis} atisCode={p.atisCode} />
                    )}
                    <Separator className="mt-2 opacity-50" />
                  </div>
                ))
            )}
          </div>
        </ScrollArea>

        <Separator />

        <div className="p-6 flex flex-col gap-4">
          {!session ? (
            <a href="/login" className="text-sm text-blue-400 underline text-center hover:text-blue-300 transition-colors">
              Accedi per attivare gli alert
            </a>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Alert per {icao}
              </p>

              {alerts.length > 0 && (
                <div className="flex flex-col gap-2">
                  {alerts.map(a => (
                    <div key={a.id} className="flex items-center justify-between text-xs bg-muted/50 rounded-lg px-3 py-2 border border-border/30">
                      <span className="font-mono">
                        {a.network} · {a.position_type} · {a.trigger}
                      </span>
                      <button
                        onClick={() => deleteAlert(a.id)}
                        className="text-red-400 hover:text-red-300 ml-2 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Select value={network} onValueChange={setNetwork}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Any network</SelectItem>
                    <SelectItem value="VATSIM">VATSIM</SelectItem>
                    <SelectItem value="IVAO">IVAO</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={positionType} onValueChange={setPositionType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Any position</SelectItem>
                    <SelectItem value="DEL">Delivery</SelectItem>
                    <SelectItem value="GND">Ground</SelectItem>
                    <SelectItem value="TWR">Tower</SelectItem>
                    <SelectItem value="APP">Approach</SelectItem>
                    <SelectItem value="CTR">Center</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={trigger} onValueChange={setTrigger}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Online + Offline</SelectItem>
                    <SelectItem value="online">Solo Online</SelectItem>
                    <SelectItem value="offline">Solo Offline</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  onClick={createAlert}
                  disabled={saving}
                  className="w-full h-8 text-xs mt-1"
                >
                  {saving ? 'Salvataggio...' : '+ Aggiungi alert'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
