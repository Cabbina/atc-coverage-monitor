import sql from '@/lib/db'
import { NextResponse } from 'next/server'
import { loadAirports } from '@/lib/airports'

export async function GET() {
  const rows = await sql`
    SELECT DISTINCT icao FROM atc_sessions
    WHERE end_time IS NOT NULL
    LIMIT 500
  `

  const airports = await loadAirports()

  const results = rows
    .map(row => {
      const airport = airports.get(row.icao)
      if (!airport) return null
      return { icao: row.icao, lat: airport.lat, lon: airport.lon }
    })
    .filter(Boolean)

  return NextResponse.json({ airports: results })
}
