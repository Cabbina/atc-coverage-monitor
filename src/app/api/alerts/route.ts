import { auth } from '@/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const alerts = await sql`
    SELECT * FROM alerts
    WHERE user_id = ${session.user.id}
    ORDER BY created_at DESC
  `

    return NextResponse.json(alerts)
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { icao, network = 'ANY', position_type = 'ANY', trigger = 'both' } = body

    if (!icao) {
        return NextResponse.json({ error: 'icao is required' }, { status: 400 })
    }

    const [alert] = await sql`
    INSERT INTO alerts (user_id, icao, network, position_type, trigger)
    VALUES (
      ${session.user.id},
      ${icao.toUpperCase()},
      ${network},
      ${position_type},
      ${trigger}
    )
    RETURNING *
  `

    return NextResponse.json(alert, { status: 201 })
}