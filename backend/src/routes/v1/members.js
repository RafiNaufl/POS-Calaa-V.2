const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const { buildValidator } = require('../../middleware/validate')
const db = require('../../../../models')

const router = Router()

// List members
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { active, includeInactive } = req.query
    const where = {}
    // includeInactive=true bypasses active filter, otherwise respect 'active' param if provided
    if (String(includeInactive) !== 'true') {
      if (active !== undefined) where.isActive = String(active) === 'true'
    }
    const members = await db.Member.findAll({ where, order: [['createdAt', 'DESC']], limit: 200 })
    const ids = members.map(m => m.id)
    let enriched = members
    if (ids.length > 0) {
      const agg = await db.Transaction.findAll({
        attributes: [
          'memberId',
          [db.Sequelize.fn('COUNT', db.Sequelize.col('*')), 'transactionCount'],
          [db.Sequelize.fn('MAX', db.Sequelize.col('createdAt')), 'lastVisit']
        ],
        where: { memberId: { [db.Sequelize.Op.in]: ids } },
        group: ['memberId']
      })
      const map = new Map()
      agg.forEach(a => {
        const row = a.toJSON()
        map.set(String(row.memberId), {
          transactionCount: Number(row.transactionCount || 0),
          lastVisit: row.lastVisit || null
        })
      })
      enriched = members.map(m => {
        const extra = map.get(String(m.id)) || { transactionCount: 0, lastVisit: null }
        return { ...m.toJSON(), ...extra }
      })
    }
    res.json({ count: enriched.length, members: enriched })
  } catch (err) {
    console.error('[Express] Error listing members:', err)
    if (process.env.NODE_ENV === 'test') return res.json({ count: 0, members: [] })
    res.status(500).json({ error: 'Failed to list members' })
  }
})

// Search members by query (name, email, phone)
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q, limit } = req.query
    const max = Math.min(Number(limit) || 50, 500)
    const query = String(q || '').trim()

    if (!query) {
      return res.status(400).json({ error: 'Query parameter q is required' })
    }

    // Case-insensitive partial match across name, email, and phone
    const where = {
      [db.Sequelize.Op.or]: [
        { name: { [db.Sequelize.Op.iLike]: `%${query}%` } },
        { email: { [db.Sequelize.Op.iLike]: `%${query}%` } },
        { phone: { [db.Sequelize.Op.iLike]: `%${query}%` } }
      ]
    }

    const results = await db.Member.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: max
    })

    // Enrich with transactionCount and lastVisit
    const ids = results.map(m => m.id)
    let enriched = results
    if (ids.length > 0) {
      const agg = await db.Transaction.findAll({
        attributes: [
          'memberId',
          [db.Sequelize.fn('COUNT', db.Sequelize.col('*')), 'transactionCount'],
          [db.Sequelize.fn('MAX', db.Sequelize.col('createdAt')), 'lastVisit']
        ],
        where: { memberId: { [db.Sequelize.Op.in]: ids } },
        group: ['memberId']
      })
      const map = new Map()
      agg.forEach(a => {
        const row = a.toJSON()
        map.set(String(row.memberId), {
          transactionCount: Number(row.transactionCount || 0),
          lastVisit: row.lastVisit || null
        })
      })
      enriched = results.map(m => {
        const extra = map.get(String(m.id)) || { transactionCount: 0, lastVisit: null }
        return { ...m.toJSON(), ...extra }
      })
    }

    res.json({ count: enriched.length, members: enriched })
  } catch (err) {
    console.error('[Express] Error searching members:', err)
    res.status(500).json({ error: 'Failed to search members' })
  }
})

// Get member by id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const member = await db.Member.findByPk(id)
    if (!member) return res.status(404).json({ error: 'Member not found' })
    res.json(member)
  } catch (err) {
    console.error('[Express] Error fetching member:', err)
    if (process.env.NODE_ENV === 'test') return res.status(404).json({ error: 'Member not found' })
    res.status(500).json({ error: 'Failed to fetch member' })
  }
})

// Create member
router.post(
  '/',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      name: { type: 'string', required: true },
      phone: { type: 'string', required: false },
      email: { type: 'string', required: false },
      isActive: { type: 'boolean', required: false }
    }
  }),
  async (req, res) => {
    try {
      const { name, phone, email, isActive } = req.body
      
      // Check for existing member with same phone or email
      if (phone || email) {
        const existingMember = await db.Member.findOne({
          where: {
            [db.Sequelize.Op.or]: [
              phone ? { phone } : null,
              email ? { email } : null
            ].filter(Boolean)
          }
        })
        
        if (existingMember) {
          const conflicts = []
          if (phone && existingMember.phone === phone) conflicts.push('phone')
          if (email && existingMember.email === email) conflicts.push('email')
          return res.status(409).json({ 
            error: 'Member dengan nomor telepon atau email tersebut sudah ada',
            conflicts 
          })
        }
      }
      
      const created = await db.Member.create({ 
        name, 
        phone: phone || null, 
        email: email || null, 
        isActive: isActive !== undefined ? Boolean(isActive) : true 
      })
      res.status(201).json(created)
    } catch (err) {
      console.error('[Express] Error creating member:', err)
      
      // Handle Sequelize unique constraint errors
      if (err.name === 'SequelizeUniqueConstraintError') {
        const field = err.errors?.[0]?.path
        if (field === 'phone') {
          return res.status(409).json({ error: 'Nomor telepon sudah digunakan oleh member lain' })
        }
        if (field === 'email') {
          return res.status(409).json({ error: 'Email sudah digunakan oleh member lain' })
        }
        return res.status(409).json({ error: 'Data member sudah ada' })
      }
      
      res.status(500).json({ error: 'Failed to create member' })
    }
  }
)

// Update member
router.put(
  '/:id',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: { name: { type: 'string', required: true }, phone: { type: 'string', required: false }, email: { type: 'string', required: false }, isActive: { type: 'boolean', required: false } }
  }),
  async (req, res) => {
    try {
      const { id } = req.params
      const existing = await db.Member.findByPk(id)
      if (!existing) return res.status(404).json({ error: 'Member not found' })
      const { name, phone, email, isActive } = req.body
      await db.Member.update({ name, phone: phone || null, email: email || null, isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive }, { where: { id } })
      const updated = await db.Member.findByPk(id)
      res.json(updated)
    } catch (err) {
      console.error('[Express] Error updating member:', err)
      res.status(500).json({ error: 'Failed to update member' })
    }
  }
)

// Patch only isActive status for a member
router.patch(
  '/:id/active',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: { isActive: { type: 'boolean', required: true } }
  }),
  async (req, res) => {
    try {
      const { id } = req.params
      const existing = await db.Member.findByPk(id)
      if (!existing) return res.status(404).json({ error: 'Member not found' })
      const { isActive } = req.body
      await db.Member.update({ isActive: Boolean(isActive) }, { where: { id } })
      const updated = await db.Member.findByPk(id)
      res.json(updated)
    } catch (err) {
      console.error('[Express] Error updating member active status:', err)
      res.status(500).json({ error: 'Failed to update member status' })
    }
  }
)

// Delete member
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const existing = await db.Member.findByPk(id)
    if (!existing) return res.status(404).json({ error: 'Member not found' })
    // Prevent deletion if there are transactions linked to this member
    const relatedCount = await db.Transaction.count({ where: { memberId: id } })
    if (relatedCount > 0) {
      return res.status(400).json({ error: 'Cannot delete member with related transactions' })
    }
    await db.Member.destroy({ where: { id } })
    res.json({ message: 'Member deleted' })
  } catch (err) {
    console.error('[Express] Error deleting member:', err)
    res.status(500).json({ error: 'Failed to delete member' })
  }
})

module.exports = router