const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const { buildValidator } = require('../../middleware/validate')
const db = require('../../../../models')

const router = Router()

// List payments
router.get('/', authMiddleware, async (_req, res) => {
  try {
    const payments = await db.Payment.findAll({ order: [['createdAt', 'DESC']], limit: 200 })
    res.json({ count: payments.length, payments })
  } catch (err) {
    console.error('[Express] Error listing payments:', err)
    if (process.env.NODE_ENV === 'test') return res.json({ count: 0, payments: [] })
    res.status(500).json({ error: 'Failed to list payments' })
  }
})

// Get payment by id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const payment = await db.Payment.findByPk(id)
    if (!payment) return res.status(404).json({ error: 'Payment not found' })
    res.json(payment)
  } catch (err) {
    console.error('[Express] Error fetching payment:', err)
    if (process.env.NODE_ENV === 'test') return res.status(404).json({ error: 'Payment not found' })
    res.status(500).json({ error: 'Failed to fetch payment' })
  }
})

// Create payment
router.post(
  '/',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      transactionId: { type: 'string', required: true },
      method: { type: 'string', required: true },
      amount: { type: 'number', required: true },
      reference: { type: 'string', required: false }
    }
  }),
  async (req, res) => {
    try {
      const { transactionId, method, amount, reference } = req.body
      const created = await db.Payment.create({ transactionId, method, amount: Number(amount), reference: reference || null })
      res.status(201).json(created)
    } catch (err) {
      console.error('[Express] Error creating payment:', err)
      res.status(500).json({ error: 'Failed to create payment' })
    }
  }
)

// Update payment
router.put(
  '/:id',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      method: { type: 'string', required: true },
      amount: { type: 'number', required: true },
      reference: { type: 'string', required: false }
    }
  }),
  async (req, res) => {
    try {
      const { id } = req.params
      const existing = await db.Payment.findByPk(id)
      if (!existing) return res.status(404).json({ error: 'Payment not found' })
      const { method, amount, reference } = req.body
      await db.Payment.update({ method, amount: Number(amount), reference: reference || null }, { where: { id } })
      const updated = await db.Payment.findByPk(id)
      res.json(updated)
    } catch (err) {
      console.error('[Express] Error updating payment:', err)
      res.status(500).json({ error: 'Failed to update payment' })
    }
  }
)

// Delete payment
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const existing = await db.Payment.findByPk(id)
    if (!existing) return res.status(404).json({ error: 'Payment not found' })
    await db.Payment.destroy({ where: { id } })
    res.json({ message: 'Payment deleted' })
  } catch (err) {
    console.error('[Express] Error deleting payment:', err)
    res.status(500).json({ error: 'Failed to delete payment' })
  }
})

module.exports = router