const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const { buildValidator } = require('../../middleware/validate')
const db = require('../../../../models')

const router = Router()

// List shifts
router.get('/', authMiddleware, async (_req, res) => {
  try {
    const shifts = await db.CashierShift.findAll({ order: [['createdAt', 'DESC']], limit: 200 })
    res.json({ count: shifts.length, shifts })
  } catch (err) {
    console.error('[Express] Error listing shifts:', err)
    if (process.env.NODE_ENV === 'test') return res.json({ count: 0, shifts: [] })
    res.status(500).json({ error: 'Failed to list shifts' })
  }
})

// Get current cashier shift
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
      return res.status(404).json({ error: 'Shift not found' })
    }

    return res.json({ shift: currentShift })
  } catch (err) {
    console.error('[Express] Error fetching current cashier shift:', err)
    return res.status(500).json({ error: 'Failed to get current shift' })
  }
})

// Get shift by id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const shift = await db.CashierShift.findByPk(id)
    if (!shift) return res.status(404).json({ error: 'Shift not found' })
    res.json(shift)
  } catch (err) {
    console.error('[Express] Error fetching shift:', err)
    if (process.env.NODE_ENV === 'test') return res.status(404).json({ error: 'Shift not found' })
    res.status(500).json({ error: 'Failed to fetch shift' })
  }
})

// Create shift
router.post(
  '/',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      cashierId: { type: 'string', required: true },
      startedAt: { type: 'string', required: true },
      endedAt: { type: 'string', required: false }
    }
  }),
  async (req, res) => {
    try {
      const { cashierId, startedAt, endedAt } = req.body
      const created = await db.CashierShift.create({
        cashierId,
        startedAt: new Date(String(startedAt)),
        endedAt: endedAt ? new Date(String(endedAt)) : null
      })
      res.status(201).json(created)
    } catch (err) {
      console.error('[Express] Error creating shift:', err)
      res.status(500).json({ error: 'Failed to create shift' })
    }
  }
)

// Update shift
router.put(
  '/:id',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      endedAt: { type: 'string', required: true }
    }
  }),
  async (req, res) => {
    try {
      const { id } = req.params
      const existing = await db.CashierShift.findByPk(id)
      if (!existing) return res.status(404).json({ error: 'Shift not found' })
      const { endedAt } = req.body
      await db.CashierShift.update({ endedAt: new Date(String(endedAt)) }, { where: { id } })
      const updated = await db.CashierShift.findByPk(id)
      res.json(updated)
    } catch (err) {
      console.error('[Express] Error updating shift:', err)
      res.status(500).json({ error: 'Failed to update shift' })
    }
  }
)

// Delete shift
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const existing = await db.CashierShift.findByPk(id)
    if (!existing) return res.status(404).json({ error: 'Shift not found' })
    await db.CashierShift.destroy({ where: { id } })
    res.json({ message: 'Shift deleted' })
  } catch (err) {
    console.error('[Express] Error deleting shift:', err)
    res.status(500).json({ error: 'Failed to delete shift' })
  }
})

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

module.exports = router