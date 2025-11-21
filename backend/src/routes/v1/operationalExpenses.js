const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const { buildValidator } = require('../../middleware/validate')
const db = require('../../../../models')
const { Op } = require('sequelize')

const router = Router()

async function ensureOperationalExpenseTable() {
  try {
    await db.sequelize.getQueryInterface().describeTable('operational_expense')
  } catch (error) {
    try {
      await db.OperationalExpense.sync()
      console.log('[Express] operational_expense table created via sync')
    } catch (syncError) {
      console.error('[Express] Failed to create operational_expense table:', syncError)
    }
  }
}

// List expenses with optional filters
router.get('/', authMiddleware, async (req, res) => {
  await ensureOperationalExpenseTable()
  try {
    const { startDate, endDate, category } = req.query

    const whereClause = {}
    if (startDate || endDate) {
      whereClause.date = {}
      if (startDate) whereClause.date[Op.gte] = new Date(String(startDate))
      if (endDate) whereClause.date[Op.lte] = new Date(String(endDate))
    }
    if (category) {
      whereClause.category = String(category)
    }

    const expenses = await db.OperationalExpense.findAll({
      where: whereClause,
      include: [{ model: db.User, as: 'creator', attributes: ['name'] }],
      order: [['date', 'DESC']]
    })

    const transformed = expenses.map((expense) => ({
      id: expense.id,
      name: expense.name,
      amount: expense.amount,
      category: expense.category,
      date: expense.date,
      description: expense.description,
      receipt: expense.receipt,
      createdBy: expense.createdBy,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
      user_name: expense.creator?.name || null
    }))

    const totalAmount = transformed.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const expensesByCategory = {}
    transformed.forEach((e) => {
      if (!expensesByCategory[e.category]) expensesByCategory[e.category] = 0
      expensesByCategory[e.category] += Number(e.amount || 0)
    })

    res.json({ expenses: transformed, totalAmount, expensesByCategory })
  } catch (err) {
    console.error('[Express] Error fetching operational expenses:', err)
    res.status(500).json({ error: 'Failed to fetch operational expenses' })
  }
})

// Create new expense (admin only)
router.post(
  '/',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      name: { type: 'string', required: true },
      amount: { type: 'number', required: true },
      category: { type: 'string', required: true },
      date: { type: 'string', required: true },
      description: { type: 'string', required: false },
      receipt: { type: 'string', required: false }
    }
  }),
  async (req, res) => {
    await ensureOperationalExpenseTable()
    try {
      const userId = req.user?.id || req.user?.sub
      const role = req.user?.role
      if (!userId) {
        return res.status(400).json({ error: 'Invalid user in token' })
      }
      if (role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden: Only admins can add operational expenses' })
      }

      const userExists = await db.User.findByPk(userId)
      if (!userExists) {
        return res.status(400).json({ error: 'Invalid user ID' })
      }

      const data = req.body
      const expense = await db.OperationalExpense.create({
        name: data.name,
        amount: parseFloat(String(data.amount)),
        category: data.category,
        date: new Date(String(data.date)),
        description: data.description || null,
        receipt: data.receipt || null,
        createdBy: Number(userId)
      })

      res.status(201).json(expense)
    } catch (err) {
      console.error('[Express] Error creating operational expense:', err)
      res.status(500).json({ error: 'Failed to create operational expense' })
    }
  }
)

// Get by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const expense = await db.OperationalExpense.findByPk(id, {
      include: [{ model: db.User, as: 'creator', attributes: ['name'] }]
    })
    if (!expense) return res.status(404).json({ error: 'Operational expense not found' })
    res.json(expense)
  } catch (err) {
    console.error('[Express] Error fetching operational expense:', err)
    res.status(500).json({ error: 'Failed to fetch operational expense' })
  }
})

// Update by ID (admin only)
router.put(
  '/:id',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      name: { type: 'string', required: true },
      amount: { type: 'number', required: true },
      category: { type: 'string', required: true },
      date: { type: 'string', required: true },
      description: { type: 'string', required: false },
      receipt: { type: 'string', required: false }
    }
  }),
  async (req, res) => {
    try {
      const role = req.user?.role
      if (role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden: Only admins can update operational expenses' })
      }

      const { id } = req.params
      const exists = await db.OperationalExpense.findByPk(id)
      if (!exists) return res.status(404).json({ error: 'Operational expense not found' })

      const data = req.body
      const [count, rows] = await db.OperationalExpense.update({
        name: data.name,
        amount: parseFloat(String(data.amount)),
        category: data.category,
        date: new Date(String(data.date)),
        description: data.description || null,
        receipt: data.receipt || null
      }, { where: { id }, returning: true })

      if (count < 1) return res.status(500).json({ error: 'Failed to update operational expense' })
      res.json(rows?.[0] || { updated: true })
    } catch (err) {
      console.error('[Express] Error updating operational expense:', err)
      res.status(500).json({ error: 'Failed to update operational expense' })
    }
  }
)

// Delete by ID (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const role = req.user?.role
    if (role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Only admins can delete operational expenses' })
    }
    const { id } = req.params
    const exists = await db.OperationalExpense.findByPk(id)
    if (!exists) return res.status(404).json({ error: 'Operational expense not found' })
    await db.OperationalExpense.destroy({ where: { id } })
    res.json({ message: 'Operational expense deleted successfully' })
  } catch (err) {
    console.error('[Express] Error deleting operational expense:', err)
    res.status(500).json({ error: 'Failed to delete operational expense' })
  }
})

module.exports = router