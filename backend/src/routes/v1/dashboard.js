const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const db = require('../../../../models')
const { Op } = require('sequelize')

const router = Router()

// GET /api/v1/dashboard/stats - Dashboard statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // Do not perform runtime schema/index sync here.
    // Schema management should be handled via migrations, not per-request.

    const startOfToday = new Date(); startOfToday.setHours(0,0,0,0)
    const endOfToday = new Date(); endOfToday.setHours(23,59,59,999)

    // Today sales (finalTotal of completed transactions) and count
    const todayTransactions = await db.Transaction.findAll({
      where: { status: 'COMPLETED', createdAt: { [Op.gte]: startOfToday, [Op.lte]: endOfToday } },
      attributes: ['id','finalTotal','total','discount','voucherDiscount','promoDiscount','tax','createdAt']
    })
    const todaySales = todayTransactions.reduce((sum, t) => sum + Number(t.finalTotal || 0), 0)
    const totalTransactions = todayTransactions.length

    // Total products & low stock
    const totalProducts = await db.Product.count()
    const LOW_STOCK_THRESHOLD = 5
    const lowStockItems = await db.Product.count({ where: { stock: { [Op.lte]: LOW_STOCK_THRESHOLD } } })

    // Recent transactions
    const recentTransactions = await db.Transaction.findAll({
      where: {},
      order: [['createdAt', 'DESC']],
      limit: 10,
      include: [
        { model: db.TransactionItem, as: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.User, as: 'user', attributes: ['id','name','email'] },
        { model: db.Member, as: 'member', attributes: ['id','name','phone','email'] }
      ]
    })

    // Top products (by quantity) in last 7 days
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const topRaw = await db.TransactionItem.findAll({
      attributes: ['productId', [db.sequelize.fn('SUM', db.sequelize.col('quantity')), 'sold']],
      include: [{ model: db.Transaction, as: 'transaction', attributes: [], where: { createdAt: { [Op.gte]: sevenDaysAgo }, status: 'COMPLETED' } }],
      group: ['productId'],
      order: [[db.sequelize.fn('SUM', db.sequelize.col('quantity')), 'DESC']],
      limit: 5
    })
    const topProductIds = topRaw.map(r => r.productId)
    const topProducts = await db.Product.findAll({ where: { id: { [Op.in]: topProductIds } }, attributes: ['id','name','price','stock'] })
    const topProductsWithSold = topProducts.map(p => {
      const row = topRaw.find(r => String(r.productId) === String(p.id))
      const sold = row ? Number((row.get ? row.get('sold') : row['sold']) || 0) : 0
      return { id: p.id, name: p.name, price: p.price, stock: p.stock, sold }
    })

    // Sales trend: last 7 days totals
    const salesTrend = []
    for (let i = 6; i >= 0; i--) {
      const day = new Date(); day.setDate(day.getDate() - i); day.setHours(0,0,0,0)
      const dayEnd = new Date(day); dayEnd.setHours(23,59,59,999)
      const dayTx = await db.Transaction.findAll({ where: { status: 'COMPLETED', createdAt: { [Op.gte]: day, [Op.lte]: dayEnd } }, attributes: ['finalTotal'] })
      const total = dayTx.reduce((sum, t) => sum + Number(t.finalTotal || 0), 0)
      salesTrend.push({ date: day.toISOString().slice(0,10), total })
    }

    return res.json({
      todaySales,
      totalProducts,
      lowStockItems,
      recentTransactions,
      topProducts: topProductsWithSold,
      salesTrend,
      totalTransactions
    })
  } catch (err) {
    console.error('[Express] Error computing dashboard stats:', err)
    return res.status(500).json({ error: 'Failed to compute dashboard stats' })
  }
})

// POST /api/v1/dashboard/reset - Reset dashboard-related transactional data
router.post('/reset', authMiddleware, async (req, res) => {
  try {
    await db.sequelize.transaction(async (t) => {
      // Use DELETE instead of TRUNCATE to avoid ownership permissions issues
      // Order matters due to foreign key constraints
      await db.TransactionItem.destroy({ where: {}, transaction: t })
      await db.VoucherUsage.destroy({ where: {}, transaction: t })
      await db.Transaction.destroy({ where: {}, transaction: t })
    })

    return res.json({ message: 'Dashboard data reset successfully' })
  } catch (err) {
    console.error('[Express] Dashboard reset error:', err)
    return res.status(500).json({ error: 'Failed to reset dashboard data' })
  }
})

module.exports = router