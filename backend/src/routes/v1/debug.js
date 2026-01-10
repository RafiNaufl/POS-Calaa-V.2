const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const db = require('../../../../models')

const router = Router()

router.get('/health', authMiddleware, async (req, res) => {
  try {
    const counts = {
      users: await db.User.count(),
      products: await db.Product.count(),
      categories: await db.Category.count(),
      members: await db.Member.count(),
      transactions: await db.Transaction.count(),
      promotions: await db.Promotion.count(),
      vouchers: await db.Voucher.count(),
      shifts: await db.CashierShift.count()
    }

    res.json({
      status: 'ok',
      version: 'v1',
      timestamp: new Date().toISOString(),
      user: req.user,
      db: {
        connected: true // If we got here, DB is likely working
      },
      counts
    })
  } catch (err) {
    console.error('[Debug] Health check failed:', err)
    res.status(500).json({ 
      status: 'error', 
      db: { connected: false },
      error: err.message 
    })
  }
})

module.exports = router
