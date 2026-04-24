import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ icao: string }> }
) {
  const { icao } = await params;
  const positionType = request.nextUrl.searchParams.get('position_type') || 'ALL';

  try {
    const posFilter = positionType !== 'ALL'
      ? sql`AND position_type = ${positionType}`
      : sql``;

    // Binary coverage: which hours in the last 24h had any session?
    const last24h = await sql`
      SELECT DISTINCT date_trunc('hour', start_time) AS hour, network
      FROM atc_sessions
      WHERE icao = ${icao}
        AND start_time >= NOW() - INTERVAL '24 hours'
        ${posFilter}
    `;

    const heatmap = await sql`
      SELECT EXTRACT(DOW FROM start_time)::INTEGER AS day_of_week,
             EXTRACT(HOUR FROM start_time)::INTEGER AS hour_utc,
             network,
             COUNT(DISTINCT DATE_TRUNC('hour', start_time)) AS covered_hours,
             COUNT(DISTINCT DATE_TRUNC('week', start_time)) AS total_weeks
      FROM atc_sessions
      WHERE icao = ${icao} AND end_time IS NOT NULL
        ${posFilter}
      GROUP BY day_of_week, hour_utc, network ORDER BY day_of_week, hour_utc
    `;

    return NextResponse.json({ last24h, heatmap });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
