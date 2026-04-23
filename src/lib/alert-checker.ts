import sql from './db'
import { sendAlertEmail } from './notify'
import type { ATCPosition } from './types'

type CallsignSet = Set<string>

let previousCallsigns: CallsignSet = new Set()
let initialized = false

export async function checkAlerts(current: ATCPosition[]): Promise<void> {
    const currentCallsigns = new Set(current.map(p => p.callsign))

    if (!initialized) {
        previousCallsigns = currentCallsigns
        initialized = true
        return
    }

    const wentOnline = current.filter(p => !previousCallsigns.has(p.callsign))
    const wentOffline = [...previousCallsigns].filter(cs => !currentCallsigns.has(cs))

    if (wentOnline.length === 0 && wentOffline.length === 0) {
        previousCallsigns = currentCallsigns
        return
    }

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
        if (alert.trigger === 'online' || alert.trigger === 'both') {
            for (const pos of wentOnline) {
                if (pos.icao !== alert.icao) continue
                if (alert.network !== 'ANY' && pos.network !== alert.network) continue
                if (alert.position_type !== 'ANY' && pos.positionType !== alert.position_type) continue

                console.log(`[Alert] ONLINE: ${pos.callsign} → ${alert.email}`)
                try {
                    await sendAlertEmail({
                        to: alert.email,
                        icao: pos.icao,
                        callsign: pos.callsign,
                        positionType: pos.positionType,
                        network: pos.network,
                        event: 'online',
                    })
                    await new Promise(r => setTimeout(r, 500))
                } catch (e) {
                    console.error('[Alert] Email error:', e)
                }
            }
        }

        if (alert.trigger === 'offline' || alert.trigger === 'both') {
            for (const cs of wentOffline) {
                const icao = cs.split('_')[0]
                if (icao !== alert.icao) continue

                console.log(`[Alert] OFFLINE: ${cs} → ${alert.email}`)
                try {
                    await sendAlertEmail({
                        to: alert.email,
                        icao,
                        callsign: cs,
                        positionType: alert.position_type,
                        network: alert.network,
                        event: 'offline',
                    })
                    await new Promise(r => setTimeout(r, 500))
                } catch (e) {
                    console.error('[Alert] Email error:', e)
                }
            }
        }
    }

    previousCallsigns = currentCallsigns
}