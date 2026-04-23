import sql from './db'
import type { ATCPosition } from './types'

type CallsignSet = Set<string>

let previousCallsigns: CallsignSet = new Set()

export async function checkAlerts(current: ATCPosition[]): Promise<void> {
    const currentCallsigns = new Set(current.map(p => p.callsign))

    // Posizioni andate online
    const wentOnline = current.filter(p => !previousCallsigns.has(p.callsign))

    // Posizioni andate offline
    const wentOffline = [...previousCallsigns].filter(cs => !currentCallsigns.has(cs))

    if (wentOnline.length === 0 && wentOffline.length === 0) {
        previousCallsigns = currentCallsigns
        return
    }

    // Carica tutti gli alert attivi rilevanti
    const icaosOnline = [...new Set(wentOnline.map(p => p.icao))]
    const icaosOffline = [...new Set(wentOffline.map(cs => cs.split('_')[0]))]
    const allIcaos = [...new Set([...icaosOnline, ...icaosOffline])]

    if (allIcaos.length === 0) {
        previousCallsigns = currentCallsigns
        return
    }

    const alerts = await sql`
    SELECT a.*, u.email
    FROM alerts a
    JOIN users u ON u.id = a.user_id
    WHERE a.enabled = true
      AND a.icao = ANY(${allIcaos})
  `

    for (const alert of alerts) {
        // Controlla went online
        if (alert.trigger === 'online' || alert.trigger === 'both') {
            for (const pos of wentOnline) {
                if (pos.icao !== alert.icao) continue
                if (alert.network !== 'ANY' && pos.network !== alert.network) continue
                if (alert.position_type !== 'ANY' && pos.positionType !== alert.position_type) continue

                console.log(`[Alert] ONLINE: ${pos.callsign} → ${alert.email}`)
                // TODO: invia notifica
            }
        }

        // Controlla went offline
        if (alert.trigger === 'offline' || alert.trigger === 'both') {
            for (const cs of wentOffline) {
                const icao = cs.split('_')[0]
                if (icao !== alert.icao) continue

                console.log(`[Alert] OFFLINE: ${cs} → ${alert.email}`)
                // TODO: invia notifica
            }
        }
    }

    previousCallsigns = currentCallsigns
}