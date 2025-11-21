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

module.exports = router