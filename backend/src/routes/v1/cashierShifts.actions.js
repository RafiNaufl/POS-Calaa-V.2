const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const db = require('../../../../models')

const router = Router()

// Open cashier shift
router.post('/open', authMiddleware, async (req, res) => {
  try {
    // Accept both `id` and `sub` for backward compatibility with older tokens
    const userIdRaw = (req.user?.id ?? req.user?.sub)
    const userId = parseInt(String(userIdRaw), 10)
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Dev safety: sync models in non-production
    if (process.env.NODE_ENV !== 'production') {
      try { await db.sequelize.sync() } catch (err) { console.error('[cashier-shifts/open] sync error:', err) }
    }

    const { openingBalance } = req.body || {}
    const parsed = parseFloat(String(openingBalance))
    if (Number.isNaN(parsed) || parsed < 0) {
      return res.status(400).json({ error: 'Saldo pembukaan tidak valid' })
    }

    const existingUser = await db.User.findByPk(userId)
    if (!existingUser) {
      return res.status(401).json({ error: 'User not found. Please sign out and sign in again.' })
    }

    const existing = await db.CashierShift.findOne({
      where: { userId, status: 'OPEN' },
      order: [['startedAt', 'DESC']]
    })
    if (existing) {
      return res.status(400).json({ error: 'Shift kasir sudah dibuka' })
    }

    const shift = await db.CashierShift.create({
      userId,
      openingBalance: parsed,
      closingBalance: null,
      status: 'OPEN',
      physicalCash: 0,
      systemTotal: 0,
      difference: 0,
      startedAt: new Date()
    })

    await db.CashierShiftLog.create({
      cashierShiftId: shift.id,
      action: 'OPEN_SHIFT',
      details: JSON.stringify({ openingBalance: parsed })
    })

    const withUser = await db.CashierShift.findByPk(shift.id, {
      include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }]
    })

    return res.json({ shift: withUser })
  } catch (error) {
    console.error('[cashier-shifts/open] Error:', error)
    return res.status(500).json({ error: 'Gagal membuka shift kasir' })
  }
})

// Close cashier shift
router.post('/close', authMiddleware, async (req, res) => {
  try {
    // Accept both `id` and `sub` for backward compatibility
    const userIdRaw = (req.user?.id ?? req.user?.sub)
    const userId = parseInt(String(userIdRaw), 10)
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Dev safety: sync models in non-production
    if (process.env.NODE_ENV !== 'production') {
      try { await db.sequelize.sync() } catch (err) { console.error('[cashier-shifts/close] sync error:', err) }
    }

    const { closingBalance } = req.body || {}
    const parsed = parseFloat(String(closingBalance))
    if (Number.isNaN(parsed) || parsed < 0) {
      return res.status(400).json({ error: 'Saldo penutupan tidak valid' })
    }

    const existingUser = await db.User.findByPk(userId)
    if (!existingUser) {
      return res.status(401).json({ error: 'User not found. Please sign out and sign in again.' })
    }

    const shift = await db.CashierShift.findOne({
      where: { userId, status: 'OPEN' },
      order: [['startedAt', 'DESC']]
    })
    if (!shift) {
      return res.status(400).json({ error: 'Tidak ada shift aktif' })
    }

    const pendingCount = await db.Transaction.count({ where: { userId, status: 'PENDING' } })
    if (pendingCount > 0) {
      return res.status(400).json({ error: `Terdapat ${pendingCount} transaksi PENDING. Selesaikan atau batalkan terlebih dahulu.` })
    }

    const { Op } = db.Sequelize
    const baseRange = { userId, createdAt: { [Op.between]: [shift.startedAt, new Date()] } }
    const completedRange = { ...baseRange, status: 'COMPLETED' }

    const allTotalRow = await db.Transaction.findAll({
      where: completedRange,
      attributes: [[db.sequelize.fn('SUM', db.sequelize.col('finalTotal')), 'sum']],
      raw: true
    })
    const totalTransactions = parseFloat(String(allTotalRow?.[0]?.sum || 0)) || 0

    const cashTotalRow = await db.Transaction.findAll({
      where: { ...completedRange, paymentMethod: 'CASH' },
      attributes: [[db.sequelize.fn('SUM', db.sequelize.col('finalTotal')), 'sum']],
      raw: true
    })
    const cashTotal = parseFloat(String(cashTotalRow?.[0]?.sum || 0)) || 0

    const expectedCash = parseFloat(String(shift.openingBalance)) + cashTotal
    const difference = parsed - expectedCash

    await db.CashierShift.update({
      closingBalance: parsed,
      physicalCash: parsed,
      systemTotal: expectedCash,
      difference: difference,
      endedAt: new Date(),
      status: 'CLOSED'
    }, { where: { id: shift.id } })

    await db.CashierShiftLog.create({
      cashierShiftId: shift.id,
      action: 'CLOSE_SHIFT',
      details: JSON.stringify({ closingBalance: parsed, expectedCash, difference, totalTransactions, cashTotal })
    })

    const closed = await db.CashierShift.findByPk(shift.id)

    const paymentMethods = ['CASH', 'CARD', 'QRIS', 'BANK_TRANSFER']
    const paymentBreakdown = {}
    for (const method of paymentMethods) {
      const rows = await db.Transaction.findAll({
        where: { ...completedRange, paymentMethod: method },
        attributes: [
          [db.sequelize.fn('SUM', db.sequelize.col('finalTotal')), 'sum'],
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
        ],
        raw: true
      })
      paymentBreakdown[method] = {
        total: parseFloat(String(rows?.[0]?.sum || 0)) || 0,
        count: parseInt(String(rows?.[0]?.count || 0)) || 0
      }
    }

    const statuses = ['COMPLETED', 'PENDING', 'CANCELLED', 'REFUNDED']
    const statusCounts = {}
    for (const s of statuses) {
      const cnt = await db.Transaction.count({ where: { ...baseRange, status: s } })
      statusCounts[s] = cnt || 0
    }

    const sums = await db.Transaction.findAll({
      where: completedRange,
      attributes: [
        [db.sequelize.fn('SUM', db.sequelize.col('discount')), 'discountSum'],
        [db.sequelize.fn('SUM', db.sequelize.col('voucherDiscount')), 'voucherSum'],
        [db.sequelize.fn('SUM', db.sequelize.col('promoDiscount')), 'promoSum'],
        [db.sequelize.fn('SUM', db.sequelize.col('tax')), 'taxSum'],
        [db.sequelize.fn('SUM', db.sequelize.col('pointsEarned')), 'pointsEarnedSum'],
        [db.sequelize.fn('SUM', db.sequelize.col('pointsUsed')), 'pointsUsedSum']
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

    const itemsSoldRow = await db.TransactionItem.findAll({
      attributes: [[db.sequelize.fn('SUM', db.sequelize.col('quantity')), 'qtySum']],
      include: [{
        model: db.Transaction,
        as: 'transaction',
        attributes: [],
        where: completedRange
      }],
      raw: true
    })
    const itemsSold = parseInt(String(itemsSoldRow?.[0]?.qtySum || 0)) || 0

    const logs = await db.CashierShiftLog.findAll({
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
      logs: logs.map(l => ({ id: l.id, action: l.action, details: l.details, createdAt: l.createdAt }))
    }

    return res.json({ report })
  } catch (error) {
    console.error('[cashier-shifts/close] Error:', error)
    return res.status(500).json({ error: 'Gagal menutup shift kasir' })
  }
})

// Get current cashier shift (native implementation)
router.get('/current', authMiddleware, async (req, res) => {
  try {
    // Accept both `id` and `sub` for backward compatibility
    const userId = (req.user?.id ?? req.user?.sub)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const currentShift = await db.CashierShift.findOne({
      where: { userId, status: 'OPEN' },
      order: [['startedAt', 'DESC']]
    })

    if (!currentShift) {
      return res.status(404).json({ error: 'No open shift found' })
    }

    return res.json({ shift: currentShift })
  } catch (err) {
    console.error('[Express] Error fetching current cashier shift:', err)
    return res.status(500).json({ error: 'Failed to get current shift' })
  }
})

module.exports = router