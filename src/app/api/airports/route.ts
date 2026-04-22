import { NextResponse } from 'next/server';
import { loadAirports } from '@/lib/airports';

export async function GET() {
  const airportsMap = await loadAirports();
  
  // Convert Map to Object for JSON serialization
  const data = Object.fromEntries(airportsMap);
  
  return NextResponse.json(data);
}
