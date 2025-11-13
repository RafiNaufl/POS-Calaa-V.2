import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import db from '@/models'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure database tables exist in development to avoid missing table errors
    if (process.env.NODE_ENV !== 'production') {
      try {
        await (db as any).sequelize.sync()
      } catch (err) {
        console.error('[cashier-shifts/current] Failed to sync models:', err)
      }
    }

    const current = await (db as any).CashierShift.findOne({
      where: { userId: session.user.id, status: 'OPEN' },
      order: [['startedAt', 'DESC']],
      include: [{ model: (db as any).User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }]
    })

    return NextResponse.json({ shift: current || null })
  } catch (error) {
    console.error('[cashier-shifts/current] Error:', error)
    return NextResponse.json({ error: 'Failed to load current shift' }, { status: 500 })
  }
}