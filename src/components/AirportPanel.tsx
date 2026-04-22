'use client';

import React from 'react';
import { ATCPosition } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface AirportPanelProps {
  icao: string | null;
  positions: ATCPosition[];
  onClose: () => void;
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

export function AirportPanel({ icao, positions, onClose }: AirportPanelProps) {
  if (!icao) return null;

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
    <Sheet open={!!icao} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md w-full p-0 flex flex-col gap-0 border-l border-border/50 bg-background shadow-2xl">
        <SheetHeader className="p-6 pb-4">
          <div className="flex items-center justify-between gap-4">
            <SheetTitle className="text-4xl font-bold tracking-tighter">
              {icao}
            </SheetTitle>
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
          </div>
          <SheetDescription className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Airport ATC Coverage
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <ScrollArea className="flex-1 px-6">
          <div className="py-6 flex flex-col gap-6">
            {positions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground italic">
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
                          className={`w-fit font-bold ${
                            POSITION_COLORS[p.positionType] || 'bg-secondary'
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
                      <Accordion type="single" collapsible className="w-full border-none">
                        <AccordionItem value="atis" className="border-none">
                          <AccordionTrigger className="py-1 text-xs font-bold text-muted-foreground hover:no-underline">
                            VIEW ATIS {p.atisCode ? `[${p.atisCode}]` : ''}
                          </AccordionTrigger>
                          <AccordionContent className="p-3 rounded-lg bg-muted/50 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap border border-border/50">
                            {Array.isArray(p.atis) ? p.atis.join(' \n') : p.atis}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}
                    <Separator className="mt-2 opacity-50" />
                  </div>
                ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
