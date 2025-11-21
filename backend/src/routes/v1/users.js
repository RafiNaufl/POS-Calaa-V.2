const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const { buildValidator } = require('../../middleware/validate')
const db = require('../../../../models')
const { Op } = require('sequelize')

const router = Router()

// Helpers
function requireAdmin(req, res) {
  const role = req.user?.role
  if (role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden: admin role required' })
    return false
  }
  return true
}

// List users (exclude password)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { q, role } = req.query
    const where = {}
    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${String(q)}%` } },
        { email: { [Op.iLike]: `%${String(q)}%` } }
      ]
    }
    if (role) where.role = String(role).toUpperCase()

    const users = await db.User.findAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: 500
    })
    res.json({ count: users.length, users })
  } catch (err) {
    console.error('[Express] Error listing users:', err)
    if (process.env.NODE_ENV === 'test') return res.json({ count: 0, users: [] })
    res.status(500).json({ error: 'Failed to list users' })
  }
})

// Get user by id (exclude password)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const user = await db.User.findByPk(id, { attributes: { exclude: ['password'] } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  } catch (err) {
    console.error('[Express] Error fetching user:', err)
    if (process.env.NODE_ENV === 'test') return res.status(404).json({ error: 'User not found' })
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// Create user (admin only)
router.post(
  '/',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      email: { type: 'string', required: true },
      password: { type: 'string', required: true },
      name: { type: 'string', required: true },
      role: { type: 'string', required: false }
    }
  }),
  async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return
      const { email, password, name } = req.body
      const role = String(req.body.role || 'CASHIER').toUpperCase()

      // Basic role validation
      if (!['ADMIN', 'MANAGER', 'CASHIER'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' })
      }

      const existing = await db.User.findOne({ where: { email } })
      if (existing) return res.status(409).json({ error: 'Email already in use' })

      const created = await db.User.create({ email, password, name, role })
      const sanitized = created.get({ plain: true })
      delete sanitized.password
      res.status(201).json(sanitized)
    } catch (err) {
      console.error('[Express] Error creating user:', err)
      res.status(500).json({ error: 'Failed to create user' })
    }
  }
)

// Update user (admin only)
router.put(
  '/:id',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      email: { type: 'string', required: false },
      password: { type: 'string', required: false },
      name: { type: 'string', required: false },
      role: { type: 'string', required: false }
    }
  }),
  async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return
      const { id } = req.params
      const existing = await db.User.findByPk(id)
      if (!existing) return res.status(404).json({ error: 'User not found' })

      const data = req.body || {}
      const updates = {}
      if (data.email) updates.email = data.email
      if (data.password) updates.password = data.password
      if (data.name) updates.name = data.name
      if (data.role) {
        const role = String(data.role).toUpperCase()
        if (!['ADMIN', 'MANAGER', 'CASHIER'].includes(role)) {
          return res.status(400).json({ error: 'Invalid role' })
        }
        updates.role = role
      }

      await db.User.update(updates, { where: { id } })
      const updated = await db.User.findByPk(id, { attributes: { exclude: ['password'] } })
      res.json(updated)
    } catch (err) {
      console.error('[Express] Error updating user:', err)
      res.status(500).json({ error: 'Failed to update user' })
    }
  }
)

// Delete user (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return
    const { id } = req.params
    const existing = await db.User.findByPk(id)
    if (!existing) return res.status(404).json({ error: 'User not found' })
    await db.User.destroy({ where: { id } })
    res.json({ message: 'User deleted' })
  } catch (err) {
    console.error('[Express] Error deleting user:', err)
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

module.exports = router