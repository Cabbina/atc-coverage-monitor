import sql from './db'
import type { ATCPosition } from './types'

// Apre sessioni nuove o le trova già aperte
export async function upsertOpenSessions(positions: ATCPosition[]): Promise<void> {
    if (positions.length === 0) return

    const now = new Date()

    for (const pos of positions) {
        const icao = extractIcao(pos.callsign)
        if (!icao) continue

        await sql`
      INSERT INTO atc_sessions (network, callsign, icao, position_type, controller_id, start_time, source)
      VALUES (
        ${pos.network},
        ${pos.callsign},
        ${icao},
        ${pos.type},
        ${pos.cid ?? null},
        ${pos.connectedAt ? new Date(pos.connectedAt) : now},
        'live'
      )
      ON CONFLICT DO NOTHING
    `
    }
}

// Chiude le sessioni che non sono più nel feed live
export async function closestaleSessions(activeCallsigns: string[], network: string): Promise<void> {
    if (activeCallsigns.length === 0) {
        // Nessuna posizione attiva — chiudi tutte le sessioni aperte per questa rete
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

// Utility: estrae ICAO dal callsign (es. EDDF_TWR → EDDF)
export function extractIcao(callsign: string): string | null {
    const match = callsign.match(/^([A-Z]{4})/)
    return match ? match[1] : null
}