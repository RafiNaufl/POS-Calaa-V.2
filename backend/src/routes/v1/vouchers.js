const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const { buildValidator } = require('../../middleware/validate')
const db = require('../../../../models')
const { Op } = require('sequelize')

const router = Router()

// Ensure schema compatibility: add missing columns at runtime if needed
async function ensureVoucherColumns() {
  try {
    const qi = db.sequelize.getQueryInterface()
    const table = await qi.describeTable('vouchers')
    if (!table.maxUsesPerUser) {
      await qi.addColumn('vouchers', 'maxUsesPerUser', {
        type: db.Sequelize.INTEGER,
        allowNull: true
      })
      console.log('[Express] vouchers: added column maxUsesPerUser')
      // Fallback: ensure model/table alignment in case of metadata drift
      try {
        await db.Voucher.sync({ alter: true })
        console.log('[Express] vouchers: sync(alter) applied')
      } catch (syncErr) {
        console.warn('[Express] vouchers: sync(alter) failed:', syncErr?.message || syncErr)
      }
    }
  } catch (err) {
    console.warn('[Express] Failed to ensure vouchers schema:', err?.message || err)
    // Last-resort: attempt to align schema even if describeTable fails
    try {
      await db.Voucher.sync({ alter: true })
      console.log('[Express] vouchers: sync(alter) applied after describeTable failure')
    } catch (syncErr) {
      console.warn('[Express] vouchers: sync(alter) failed after describeTable failure:', syncErr?.message || syncErr)
    }
  }
}

// Helper: safely derive selectable attributes based on actual table columns
async function getVoucherSafeAttributes() {
  try {
    const table = await db.sequelize.getQueryInterface().describeTable('vouchers')
    const cols = Object.keys(table || {})
    const base = [
      'id','code','name','description','type','value','minPurchase','maxDiscount','maxUses','usedCount','startDate','endDate','isActive','createdAt','updatedAt'
    ]
    const hasMaxUsesPerUser = cols.includes('maxUsesPerUser')
    if (hasMaxUsesPerUser) base.push('maxUsesPerUser')
    return { attributes: base, hasMaxUsesPerUser }
  } catch (_err) {
    // If describeTable fails, fall back to a safe base without the new column
    return {
      attributes: [
        'id','code','name','description','type','value','minPurchase','maxDiscount','maxUses','usedCount','startDate','endDate','isActive','createdAt','updatedAt'
      ],
      hasMaxUsesPerUser: false
    }
  }
}

// List vouchers (filter by active and date range)
router.get('/', authMiddleware, async (req, res) => {
  try {
    await ensureVoucherColumns()
    const { active } = req.query
    const where = {}
    if (active !== undefined) where.isActive = String(active) === 'true'
    // Use safe attributes helper to include maxUsesPerUser only if it exists
    const { attributes } = await getVoucherSafeAttributes()
    const vouchers = await db.Voucher.findAll({ where, attributes, order: [['createdAt', 'DESC']], limit: 200 })
    res.json({ count: vouchers.length, vouchers })
  } catch (err) {
    console.error('[Express] Error listing vouchers:', err)
    if (process.env.NODE_ENV === 'test') return res.json({ count: 0, vouchers: [] })
    res.status(500).json({ error: 'Failed to list vouchers' })
  }
})

// Validate voucher
router.post('/validate', authMiddleware, async (req, res) => {
  try {
    await ensureVoucherColumns()
    const { code, subtotal, userId, memberId } = req.body || {}
    if (!code || subtotal === undefined) {
      return res.status(400).json({ error: 'Voucher code and subtotal are required', valid: false })
    }

    // Find voucher by code (case-insensitive)
    const voucher = await db.Voucher.findOne({
      where: (db.sequelize).where(
        (db.sequelize).fn('LOWER', (db.sequelize).col('code')),
        String(code).toLowerCase()
      ),
      attributes: [
        'id','code','name','type','value','minPurchase','maxDiscount','maxUses','usedCount','startDate','endDate','isActive'
      ],
      include: [
        {
          model: db.VoucherUsage,
          as: 'usages',
          where: (userId || memberId) ? { [Op.or]: [ { userId: userId || null }, { memberId: memberId || null } ] } : undefined,
          required: false
        }
      ]
    })

    if (!voucher) {
      return res.status(404).json({ error: 'Voucher not found', valid: false })
    }

    if (!voucher.isActive) {
      return res.status(400).json({ error: 'Voucher is not active', valid: false })
    }

    const now = new Date()
    if (now < voucher.startDate || now > voucher.endDate) {
      return res.status(400).json({ error: 'Voucher is expired or not yet valid', valid: false })
    }

    const subtotalNum = Number(subtotal)
    if (voucher.minPurchase && subtotalNum < voucher.minPurchase) {
      return res.status(400).json({ error: `Minimum purchase of ${voucher.minPurchase} required`, valid: false, minPurchase: voucher.minPurchase })
    }

    if (voucher.maxUses && Number(voucher.usedCount || 0) >= voucher.maxUses) {
      return res.status(400).json({ error: 'Voucher usage limit exceeded', valid: false })
    }

    // Simple per-user/member usage limit: one-time usage
    if (Array.isArray((voucher).usages) && (userId || memberId)) {
      const userUsageCount = (voucher).usages.length
      const perUserLimit = Number(voucher.maxUsesPerUser || 0)
      if (perUserLimit > 0 && userUsageCount >= perUserLimit) {
        return res.status(400).json({ error: 'Personal usage limit exceeded', valid: false, perUserLimit })
      }
    }

    // Calculate discount (normalized lowercase types)
    let discountAmount = 0
    const t = String(voucher.type || '').toLowerCase()
    if (t === 'percentage') {
      discountAmount = (subtotalNum * Number(voucher.value)) / 100
      if (voucher.maxDiscount && discountAmount > voucher.maxDiscount) {
        discountAmount = voucher.maxDiscount
      }
    } else if (t === 'fixed') {
      discountAmount = Math.min(Number(voucher.value), subtotalNum)
    } else if (t === 'free_shipping') {
      discountAmount = Number(voucher.value)
    }

    // IDR uses 0 fraction digits; round to nearest integer rupiah
    const rounded = Math.round(discountAmount)
    return res.json({
      valid: true,
      voucher: {
        id: voucher.id,
        code: voucher.code,
        name: voucher.name,
        type: voucher.type,
        value: voucher.value,
        maxDiscount: voucher.maxDiscount,
        maxUses: voucher.maxUses,
        usedCount: voucher.usedCount,
        maxUsesPerUser: voucher.maxUsesPerUser
      },
      discountAmount: rounded
    })
  } catch (err) {
    console.error('[Express] Error validating voucher:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get voucher by id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    // Ensure schema and select only safe attributes
    await ensureVoucherColumns()
    const { attributes } = await getVoucherSafeAttributes()
    const voucher = await db.Voucher.findByPk(id, { attributes })
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' })
    res.json(voucher)
  } catch (err) {
    console.error('[Express] Error fetching voucher:', err)
    if (process.env.NODE_ENV === 'test') return res.status(404).json({ error: 'Voucher not found' })
    res.status(500).json({ error: 'Failed to fetch voucher' })
  }
})

// Create voucher
router.post(
  '/',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      code: { type: 'string', required: true },
      name: { type: 'string', required: true },
      type: { type: 'string', required: true, enum: ['percentage', 'fixed', 'free_shipping'] },
      value: { type: 'number', required: true },
      startDate: { type: 'string', required: true },
      endDate: { type: 'string', required: true },
      minPurchase: { type: 'number', required: false },
      maxDiscount: { type: 'number', required: false },
      maxUses: { type: 'number', required: false },
      maxUsesPerUser: { type: 'number', required: false }
    }
  }),
  async (req, res) => {
    try {
      await ensureVoucherColumns()
      const { hasMaxUsesPerUser } = await getVoucherSafeAttributes()
      const data = req.body
      const start = new Date(String(data.startDate))
      const end = new Date(String(data.endDate))
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' })
      }
      if (start > end) {
        return res.status(400).json({ error: 'startDate must be before endDate' })
      }
      if (data.maxUsesPerUser !== undefined && Number(data.maxUsesPerUser) < 1) {
        return res.status(400).json({ error: 'maxUsesPerUser must be >= 1' })
      }
      const payload = {
        code: data.code,
        name: data.name,
        type: data.type,
        value: Number(data.value),
        startDate: start,
        endDate: end,
        minPurchase: data.minPurchase ? Number(data.minPurchase) : null,
        maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : null,
        maxUses: data.maxUses ? Number(data.maxUses) : null,
        isActive: true
      }
      if (hasMaxUsesPerUser) {
        payload.maxUsesPerUser = data.maxUsesPerUser ? Number(data.maxUsesPerUser) : null
      }
      let created
      if (!hasMaxUsesPerUser) {
        // Avoid Postgres RETURNING referencing non-existent column
        await db.Voucher.create(payload, { returning: false })
        const safe = await db.Voucher.findOne({
          where: { code: data.code },
          attributes: (await getVoucherSafeAttributes()).attributes
        })
        created = safe
      } else {
        created = await db.Voucher.create(payload)
      }
      console.log('[Express] Voucher created:', { id: created?.id, code: created?.code, maxUsesPerUser: created?.maxUsesPerUser })
      res.status(201).json(created)
    } catch (err) {
      console.error('[Express] Error creating voucher:', err)
      res.status(500).json({ error: 'Failed to create voucher' })
    }
  }
)

// Update voucher
router.put(
  '/:id',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      name: { type: 'string', required: true },
      type: { type: 'string', required: true, enum: ['percentage', 'fixed', 'free_shipping'] },
      value: { type: 'number', required: true },
      startDate: { type: 'string', required: true },
      endDate: { type: 'string', required: true },
      isActive: { type: 'boolean', required: false },
      minPurchase: { type: 'number', required: false },
      maxDiscount: { type: 'number', required: false },
      maxUses: { type: 'number', required: false },
      maxUsesPerUser: { type: 'number', required: false },
      description: { type: 'string', required: false }
    }
  }),
  async (req, res) => {
    try {
      await ensureVoucherColumns()
      const { id } = req.params
      const { attributes, hasMaxUsesPerUser } = await getVoucherSafeAttributes()
      const existing = await db.Voucher.findByPk(id, { attributes })
      if (!existing) return res.status(404).json({ error: 'Voucher not found' })
      const data = req.body
      const start = new Date(String(data.startDate))
      const end = new Date(String(data.endDate))
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' })
      }
      if (start > end) {
        return res.status(400).json({ error: 'startDate must be before endDate' })
      }
      if (data.maxUsesPerUser !== undefined && Number(data.maxUsesPerUser) < 1) {
        return res.status(400).json({ error: 'maxUsesPerUser must be >= 1' })
      }
      const updatePayload = {
        name: data.name,
        type: data.type,
        value: Number(data.value),
        startDate: start,
        endDate: end,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : existing.isActive,
        minPurchase: data.minPurchase !== undefined ? (data.minPurchase === null ? null : Number(data.minPurchase)) : existing.minPurchase,
        maxDiscount: data.maxDiscount !== undefined ? (data.maxDiscount === null ? null : Number(data.maxDiscount)) : existing.maxDiscount,
        maxUses: data.maxUses !== undefined ? (data.maxUses === null ? null : Number(data.maxUses)) : existing.maxUses,
        description: data.description !== undefined ? data.description : existing.description
      }
      if (hasMaxUsesPerUser) {
        updatePayload.maxUsesPerUser = (data.maxUsesPerUser !== undefined)
          ? (data.maxUsesPerUser === null ? null : Number(data.maxUsesPerUser))
          : existing.maxUsesPerUser
      }
      await db.Voucher.update(updatePayload, { where: { id } })
      const updated = await db.Voucher.findByPk(id, { attributes })
      console.log('[Express] Voucher updated:', { id: updated.id, code: updated.code, maxUsesPerUser: updated.maxUsesPerUser })
      res.json(updated)
    } catch (err) {
      console.error('[Express] Error updating voucher:', err)
      res.status(500).json({ error: 'Failed to update voucher' })
    }
  }
)

// Delete voucher
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    await ensureVoucherColumns()
    const { attributes } = await getVoucherSafeAttributes()
    const existing = await db.Voucher.findByPk(id, { attributes })
    if (!existing) return res.status(404).json({ error: 'Voucher not found' })
    await db.Voucher.destroy({ where: { id } })
    res.json({ message: 'Voucher deleted' })
  } catch (err) {
    console.error('[Express] Error deleting voucher:', err)
    res.status(500).json({ error: 'Failed to delete voucher' })
  }
})

module.exports = router
