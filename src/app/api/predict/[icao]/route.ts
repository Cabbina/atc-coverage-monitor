import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ icao: string }> }
) {
  try {
    const { icao } = await params;
    const { searchParams } = new URL(request.url);
    
    const day = parseInt(searchParams.get('day') || new Date().getUTCDay().toString());
    const hour = parseInt(searchParams.get('hour') || new Date().getUTCHours().toString());

    console.log(`[Predict] Fetching for ${icao}, day ${day}, hour ${hour}`);

    const results = await sql`
      WITH stats AS (
        SELECT
          position_type,
          COUNT(DISTINCT DATE_TRUNC('hour', start_time)) AS covered_hours,
          COUNT(DISTINCT DATE_TRUNC('week', start_time)) AS total_weeks
        FROM atc_sessions
        WHERE icao = ${icao}
          AND EXTRACT(DOW FROM start_time)::INTEGER = ${day}
          AND EXTRACT(HOUR FROM start_time)::INTEGER = ${hour}
          AND end_time IS NOT NULL
        GROUP BY position_type
      )
      SELECT
        position_type,
        covered_hours::integer as covered,
        total_weeks::integer as total,
        ROUND((covered_hours::numeric / NULLIF(total_weeks, 0)) * 100)::integer AS probability,
        ROUND(
          (
            (covered_hours::numeric / NULLIF(total_weeks, 0)) + (1.96 * 1.96 / (2 * total_weeks)) - 
            1.96 * SQRT(
              ((covered_hours::numeric / NULLIF(total_weeks, 0)) * (1 - (covered_hours::numeric / NULLIF(total_weeks, 0))) + (1.96 * 1.96 / (4 * total_weeks))) / total_weeks
            )
          ) / (1 + (1.96 * 1.96 / total_weeks)) * 100
        )::integer AS confidence
      FROM stats
      WHERE total_weeks > 0
      ORDER BY probability DESC
    `;

    // Calculate overall sample weeks for the metadata
    const maxWeeks = results.length > 0 ? Math.max(...results.map(r => r.total)) : 0;

    return NextResponse.json({
      icao,
      day,
      hour,
      sample_weeks: maxWeeks,
      predictions: results
    });

  } catch (error) {
    console.error('[Predict API Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
