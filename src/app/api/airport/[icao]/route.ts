import { NextRequest, NextResponse } from 'next/server';
import { pollerService } from '@/lib/poller-singleton';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ icao: string }> }
) {
  const { icao } = await params;
  const targetICAO = icao.toUpperCase();
  
  if (!pollerService.isRunning) {
    pollerService.start();
  }

  const snapshot = pollerService.getSnapshot();
  const filtered = snapshot.positions.filter(p => p.icao === targetICAO);

  return NextResponse.json({
    icao: targetICAO,
    positions: filtered,
    totalCount: filtered.length,
    lastFetchTime: snapshot.lastFetchTime
  });
}
