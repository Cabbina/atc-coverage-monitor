import { auth } from '@/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await sql`
    DELETE FROM alerts
    WHERE id = ${id}
      AND user_id = ${session.user.id}
  `

  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { enabled } = await req.json()

  const [alert] = await sql`
    UPDATE alerts
    SET enabled = ${enabled}
    WHERE id = ${id}
      AND user_id = ${session.user.id}
    RETURNING *
  `

  return NextResponse.json(alert)
}