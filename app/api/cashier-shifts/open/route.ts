import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import db from '@/models'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure database tables exist (dev safety): sync models before operations
    // This prevents "no such table" errors when running locally without migrations
    if (process.env.NODE_ENV !== 'production') {
      try {
        await (db as any).sequelize.sync()
      } catch (err) {
        console.error('[cashier-shifts/open] Failed to sync models:', err)
      }
    }

    const body = await request.json()
    const { openingBalance } = body

    const parsed = parseFloat(String(openingBalance))
    if (Number.isNaN(parsed) || parsed < 0) {
      return NextResponse.json({ error: 'Saldo pembukaan tidak valid' }, { status: 400 })
    }

    // Ensure no active open shift for this user
    const existing = await (db as any).CashierShift.findOne({
      where: { userId: session.user.id, status: 'OPEN' },
      order: [['startedAt', 'DESC']]
    })
    if (existing) {
      return NextResponse.json({ error: 'Shift kasir sudah dibuka' }, { status: 400 })
    }

    const shift = await (db as any).CashierShift.create({
      userId: session.user.id,
      openingBalance: parsed,
      closingBalance: null,
      status: 'OPEN',
      physicalCash: 0,
      systemTotal: 0,
      difference: 0,
      startedAt: new Date()
    })

    // Audit log
    await (db as any).CashierShiftLog.create({
      cashierShiftId: shift.id,
      action: 'OPEN_SHIFT',
      details: JSON.stringify({ openingBalance: parsed })
    })

    const withUser = await (db as any).CashierShift.findByPk(shift.id, {
      include: [{ model: (db as any).User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }]
    })

    return NextResponse.json({ shift: withUser })
  } catch (error) {
    console.error('[cashier-shifts/open] Error:', error)
    return NextResponse.json({ error: 'Gagal membuka shift kasir' }, { status: 500 })
  }
}