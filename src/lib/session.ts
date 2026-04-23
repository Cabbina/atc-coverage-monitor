import sql from './db'
import type { ATCPosition } from './types'

export async function upsertOpenSessions(positions: ATCPosition[]): Promise<void> {
  if (positions.length === 0) return

  const rows = positions
    .filter(pos => pos.icao)
    .map(pos => ({
      network: pos.network,
      callsign: pos.callsign,
      icao: pos.icao,
      position_type: pos.positionType,
      controller_id: pos.controllerId ?? null,
      start_time: new Date(pos.logonTime),
      source: 'live' as const,
    }))

  if (rows.length === 0) return

  await sql`
    INSERT INTO atc_sessions ${sql(rows)}
    ON CONFLICT DO NOTHING
  `
}

export async function closeStaleSessions(
  activeCallsigns: string[],
  network: string
): Promise<void> {
  if (activeCallsigns.length === 0) {
    await sql`
      UPDATE atc_sessions
      SET end_time = NOW()
      WHERE end_time IS NULL
        AND network = ${network}
    `
    return
  }

  await sql`
    UPDATE atc_sessions
    SET end_time = NOW()
    WHERE end_time IS NULL
      AND network = ${network}
      AND callsign NOT IN ${sql(activeCallsigns)}
  `
}