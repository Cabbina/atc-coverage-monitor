'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Prediction {
  position_type: string;
  probability: number;
  confidence: number;
  covered: number;
  total: number;
}

interface PredictorSectionProps {
  icao: string | null;
}

const DAYS = [
  { label: 'Sun', value: '0' },
  { label: 'Mon', value: '1' },
  { label: 'Tue', value: '2' },
  { label: 'Wed', value: '3' },
  { label: 'Thu', value: '4' },
  { label: 'Fri', value: '5' },
  { label: 'Sat', value: '6' },
];

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

export default function PredictorSection({ icao }: PredictorSectionProps) {
  const [day, setDay] = useState(new Date().getUTCDay().toString());
  const [hour, setHour] = useState(new Date().getUTCHours().toString());
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ predictions: Prediction[]; sample_weeks: number } | null>(null);

  const handlePredict = async () => {
    if (!icao) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/predict/${icao}?day=${day}&hour=${hour}`);
      const data = await res.json();
      setResults(data);
    } catch (error) {
      console.error('[Predict Error]:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!icao) return null;

  return (
    <div className="py-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
          ATC Predictor
        </h3>
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
          Probability of coverage at your ETA
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Select value={day} onValueChange={(val) => val && setDay(val)}>
            <SelectTrigger className="h-8 text-xs font-medium">
              <SelectValue placeholder="Day" />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d) => (
                <SelectItem key={d.value} value={d.value} className="text-xs">
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={hour} onValueChange={(val) => val && setHour(val)}>
            <SelectTrigger className="h-8 text-xs font-mono font-medium">
              <SelectValue placeholder="Hour" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i} value={i.toString()} className="text-xs font-mono">
                  {i.toString().padStart(2, '0')}z
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          size="sm"
          onClick={handlePredict}
          disabled={loading}
          className="w-full h-8 text-xs mt-0"
        >
          {loading ? 'Calculating...' : 'Predict Coverage'}
        </Button>
      </div>

      {results && (
        <div className="flex flex-col gap-2">
          {results.predictions.length === 0 ? (
            <div className="bg-muted/30 rounded-lg p-4 text-center text-[10px] text-muted-foreground italic">
              Not enough historical data for this slot
            </div>
          ) : (
            <>
              {results.predictions.map((p) => (
                <div key={p.position_type} className="flex items-center justify-between text-xs bg-muted/50 rounded-lg px-3 py-2 border border-border/30">
                  <span className="font-medium text-muted-foreground">
                    {POSITION_LABELS[p.position_type] || p.position_type}
                  </span>
                  <span 
                    className="font-bold tabular-nums"
                    style={{ color: p.probability > 70 ? '#22c55e' : p.probability > 40 ? '#f59e0b' : '#ef4444' }}
                  >
                    {p.probability}%
                  </span>
                </div>
              ))}
              <p className="text-[9px] text-center text-muted-foreground font-medium uppercase tracking-wider mt-1">
                Based on {results.sample_weeks} weeks of data
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
