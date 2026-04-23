import { auth } from '@/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// DELETE /api/alerts/:id
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await sql`
    DELETE FROM alerts
    WHERE id = ${params.id}
      AND user_id = ${session.user.id}
  `

    return NextResponse.json({ ok: true })
}

// PATCH /api/alerts/:id — toggle enabled
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { enabled } = await req.json()

    const [alert] = await sql`
    UPDATE alerts
    SET enabled = ${enabled}
    WHERE id = ${params.id}
      AND user_id = ${session.user.id}
    RETURNING *
  `

    return NextResponse.json(alert)
}