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

    // Ensure database tables exist in development to avoid missing table errors
    if (process.env.NODE_ENV !== 'production') {
      try {
        await (db as any).sequelize.sync()
      } catch (err) {
        console.error('[cashier-shifts/close] Failed to sync models:', err)
      }
    }

    const body = await request.json()
    const { closingBalance } = body

    const parsed = parseFloat(String(closingBalance))
    if (Number.isNaN(parsed) || parsed < 0) {
      return NextResponse.json({ error: 'Saldo penutupan tidak valid' }, { status: 400 })
    }

    // Find current open shift
    const shift = await (db as any).CashierShift.findOne({
      where: { userId: session.user.id, status: 'OPEN' },
      order: [['startedAt', 'DESC']]
    })
    if (!shift) {
      return NextResponse.json({ error: 'Tidak ada shift aktif' }, { status: 400 })
    }

    // Ensure no pending transactions for this user
    const pendingCount = await (db as any).Transaction.count({
      where: { userId: session.user.id, status: 'PENDING' }
    })
    if (pendingCount > 0) {
      return NextResponse.json({ error: `Terdapat ${pendingCount} transaksi PENDING. Selesaikan atau batalkan terlebih dahulu.` }, { status: 400 })
    }

    // Compute totals for the shift timeframe
    const { Op } = (db as any).Sequelize
    const baseRange = {
      userId: session.user.id,
      createdAt: { [Op.between]: [shift.startedAt, new Date()] }
    }
    const completedRange = { ...baseRange, status: 'COMPLETED' }

    // Total of all transactions
    const allTotalRow = await (db as any).Transaction.findAll({
      where: completedRange,
      attributes: [[(db as any).sequelize.fn('SUM', (db as any).sequelize.col('finalTotal')), 'sum']],
      raw: true
    })
    const totalTransactions = parseFloat(String(allTotalRow?.[0]?.sum || 0)) || 0

    // Total of CASH transactions only (for expected cash calculation)
    const cashTotalRow = await (db as any).Transaction.findAll({
      where: { ...completedRange, paymentMethod: 'CASH' },
      attributes: [[(db as any).sequelize.fn('SUM', (db as any).sequelize.col('finalTotal')), 'sum']],
      raw: true
    })
    const cashTotal = parseFloat(String(cashTotalRow?.[0]?.sum || 0)) || 0

    // Expected cash = opening + cash sales
    const expectedCash = parseFloat(String(shift.openingBalance)) + cashTotal
    const difference = parsed - expectedCash

    // Update and close shift
    await (db as any).CashierShift.update({
      closingBalance: parsed,
      physicalCash: parsed,
      systemTotal: expectedCash,
      difference: difference,
      endedAt: new Date(),
      status: 'CLOSED'
    }, { where: { id: shift.id } })

    // Audit log
    await (db as any).CashierShiftLog.create({
      cashierShiftId: shift.id,
      action: 'CLOSE_SHIFT',
      details: JSON.stringify({ closingBalance: parsed, expectedCash, difference, totalTransactions, cashTotal })
    })

    const closed = await (db as any).CashierShift.findByPk(shift.id)

    // Additional detailed metrics
    const paymentMethods = ['CASH', 'CARD', 'QRIS', 'BANK_TRANSFER']
    const paymentBreakdown: Record<string, { total: number; count: number }> = {}
    for (const method of paymentMethods) {
      const rows = await (db as any).Transaction.findAll({
        where: { ...completedRange, paymentMethod: method },
        attributes: [
          [(db as any).sequelize.fn('SUM', (db as any).sequelize.col('finalTotal')), 'sum'],
          [(db as any).sequelize.fn('COUNT', (db as any).sequelize.col('id')), 'count']
        ],
        raw: true
      })
      paymentBreakdown[method] = {
        total: parseFloat(String(rows?.[0]?.sum || 0)) || 0,
        count: parseInt(String(rows?.[0]?.count || 0)) || 0
      }
    }

    // Status counts across the shift timeframe
    const statuses = ['COMPLETED', 'PENDING', 'CANCELLED', 'REFUNDED']
    const statusCounts: Record<string, number> = {}
    for (const s of statuses) {
      const cnt = await (db as any).Transaction.count({ where: { ...baseRange, status: s } })
      statusCounts[s] = cnt || 0
    }

    // Discount/tax/points totals (completed only)
    const sums = await (db as any).Transaction.findAll({
      where: completedRange,
      attributes: [
        [(db as any).sequelize.fn('SUM', (db as any).sequelize.col('discount')), 'discountSum'],
        [(db as any).sequelize.fn('SUM', (db as any).sequelize.col('voucherDiscount')), 'voucherSum'],
        [(db as any).sequelize.fn('SUM', (db as any).sequelize.col('promoDiscount')), 'promoSum'],
        [(db as any).sequelize.fn('SUM', (db as any).sequelize.col('tax')), 'taxSum'],
        [(db as any).sequelize.fn('SUM', (db as any).sequelize.col('pointsEarned')), 'pointsEarnedSum'],
        [(db as any).sequelize.fn('SUM', (db as any).sequelize.col('pointsUsed')), 'pointsUsedSum']
      ],
      raw: true
    })
    const agg = sums?.[0] || {}
    const discountTotals = {
      discount: parseFloat(String(agg.discountSum || 0)) || 0,
      voucherDiscount: parseFloat(String(agg.voucherSum || 0)) || 0,
      promoDiscount: parseFloat(String(agg.promoSum || 0)) || 0,
      tax: parseFloat(String(agg.taxSum || 0)) || 0
    }
    const pointsTotals = {
      earned: parseFloat(String(agg.pointsEarnedSum || 0)) || 0,
      used: parseFloat(String(agg.pointsUsedSum || 0)) || 0
    }

    // Items sold count (sum of quantities) within completed transactions
    const itemsSoldRow = await (db as any).TransactionItem.findAll({
      attributes: [[(db as any).sequelize.fn('SUM', (db as any).sequelize.col('quantity')), 'qtySum']],
      include: [{
        model: (db as any).Transaction,
        as: 'transaction',
        attributes: [],
        where: completedRange
      }],
      raw: true
    })
    const itemsSold = parseInt(String(itemsSoldRow?.[0]?.qtySum || 0)) || 0

    // Shift logs
    const logs = await (db as any).CashierShiftLog.findAll({
      where: { cashierShiftId: shift.id },
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'action', 'details', 'createdAt']
    })

    const report = {
      shiftId: closed.id,
      cashierId: closed.userId,
      startTime: closed.startedAt,
      endTime: closed.endedAt,
      openingBalance: closed.openingBalance,
      cashSales: cashTotal,
      totalTransactions,
      systemExpectedCash: expectedCash,
      physicalCash: parsed,
      difference,
      paymentBreakdown,
      statusCounts,
      discountTotals,
      pointsTotals,
      itemsSold,
      logs: logs.map((l: any) => ({
        id: l.id,
        action: l.action,
        details: l.details,
        createdAt: l.createdAt
      }))
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('[cashier-shifts/close] Error:', error)
    return NextResponse.json({ error: 'Gagal menutup shift kasir' }, { status: 500 })
  }
}