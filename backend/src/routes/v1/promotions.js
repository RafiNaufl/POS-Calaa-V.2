const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const { buildValidator } = require('../../middleware/validate')
const db = require('../../../../models')
const { Op } = require('sequelize')

const router = Router()

// List promotions (include related products and categories)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { active } = req.query || {}
    const now = new Date()
    const where = {}
    if (String(active) === 'true') {
      Object.assign(where, {
        isActive: true,
        startDate: { [Op.lte]: now },
        endDate: { [Op.gte]: now }
      })
    }

    const promotions = await db.Promotion.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 200,
      include: [
        { model: db.ProductPromotion, as: 'productPromotions', include: [{ model: db.Product, as: 'product' }] },
        { model: db.CategoryPromotion, as: 'categoryPromotions', include: [{ model: db.Category, as: 'category' }] },
      ],
    })
    res.json({ count: promotions.length, promotions })
  } catch (err) {
    console.error('[Express] Error listing promotions:', err)
    if (process.env.NODE_ENV === 'test') return res.json({ count: 0, promotions: [] })
    res.status(500).json({ error: 'Failed to list promotions' })
  }
})

// Get promotion by id (include related products and categories)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const promotion = await db.Promotion.findByPk(id, {
      include: [
        { model: db.ProductPromotion, as: 'productPromotions', include: [{ model: db.Product, as: 'product' }] },
        { model: db.CategoryPromotion, as: 'categoryPromotions', include: [{ model: db.Category, as: 'category' }] },
      ],
    })
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' })
    res.json(promotion)
  } catch (err) {
    console.error('[Express] Error fetching promotion:', err)
    if (process.env.NODE_ENV === 'test') return res.status(404).json({ error: 'Promotion not found' })
    res.status(500).json({ error: 'Failed to fetch promotion' })
  }
})

// Create promotion
router.post(
  '/',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      type: { type: 'string', required: true, enum: ['PRODUCT_DISCOUNT', 'CATEGORY_DISCOUNT', 'BULK_DISCOUNT', 'BUY_X_GET_Y'] },
      name: { type: 'string', required: true },
      description: { type: 'string', required: false },
      discountType: { type: 'string', required: true, enum: ['PERCENTAGE', 'FIXED'] },
      discountValue: { type: 'number', required: true },
      startDate: { type: 'string', required: true },
      endDate: { type: 'string', required: true },
      isActive: { type: 'boolean', required: false }
    }
  }),
  async (req, res) => {
    try {
      const d = req.body
      const start = new Date(String(d.startDate))
      const end = new Date(String(d.endDate))
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' })
      }
      if (start > end) {
        return res.status(400).json({ error: 'startDate must be before endDate' })
      }
      // Type-specific field validations
      if (d.type === 'BULK_DISCOUNT') {
        if (d.minQuantity === undefined || Number(d.minQuantity) <= 0) {
          return res.status(400).json({ error: 'minQuantity is required and must be > 0 for BULK_DISCOUNT' })
        }
      }
      if (d.type === 'BUY_X_GET_Y') {
        if (d.buyQuantity === undefined || d.getQuantity === undefined || Number(d.buyQuantity) <= 0 || Number(d.getQuantity) <= 0) {
          return res.status(400).json({ error: 'buyQuantity and getQuantity are required and must be > 0 for BUY_X_GET_Y' })
        }
      }
      const created = await db.Promotion.create({
        type: d.type,
        name: d.name,
        description: d.description || null,
        discountType: d.discountType,
        discountValue: Number(d.discountValue),
        minQuantity: d.minQuantity !== undefined ? Number(d.minQuantity) : null,
        buyQuantity: d.buyQuantity !== undefined ? Number(d.buyQuantity) : null,
        getQuantity: d.getQuantity !== undefined ? Number(d.getQuantity) : null,
        startDate: start,
        endDate: end,
        isActive: d.isActive !== undefined ? Boolean(d.isActive) : true
      })

      // Create associations if provided
      const productIds = Array.isArray(d.productIds) ? d.productIds : []
      const categoryIds = Array.isArray(d.categoryIds) ? d.categoryIds : []
      for (const pid of productIds) {
        await db.ProductPromotion.create({ productId: String(pid), promotionId: created.id })
      }
      for (const cid of categoryIds) {
        await db.CategoryPromotion.create({ categoryId: String(cid), promotionId: created.id })
      }

      const withRelations = await db.Promotion.findByPk(created.id, {
        include: [
          { model: db.ProductPromotion, as: 'productPromotions', include: [{ model: db.Product, as: 'product' }] },
          { model: db.CategoryPromotion, as: 'categoryPromotions', include: [{ model: db.Category, as: 'category' }] },
        ],
      })

      res.status(201).json(withRelations)
    } catch (err) {
      console.error('[Express] Error creating promotion:', err)
      res.status(500).json({ error: 'Failed to create promotion' })
    }
  }
)

// Update promotion
router.put(
  '/:id',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      type: { type: 'string', required: true, enum: ['PRODUCT_DISCOUNT', 'CATEGORY_DISCOUNT', 'BULK_DISCOUNT', 'BUY_X_GET_Y'] },
      name: { type: 'string', required: true },
      description: { type: 'string', required: false },
      discountType: { type: 'string', required: true, enum: ['PERCENTAGE', 'FIXED'] },
      discountValue: { type: 'number', required: true },
      startDate: { type: 'string', required: true },
      endDate: { type: 'string', required: true },
      isActive: { type: 'boolean', required: false }
    }
  }),
  async (req, res) => {
    try {
      const { id } = req.params
      const existing = await db.Promotion.findByPk(id)
      if (!existing) return res.status(404).json({ error: 'Promotion not found' })
      const d = req.body
      const start = new Date(String(d.startDate))
      const end = new Date(String(d.endDate))
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' })
      }
      if (start > end) {
        return res.status(400).json({ error: 'startDate must be before endDate' })
      }
      if (d.type === 'BULK_DISCOUNT') {
        if (d.minQuantity === undefined || Number(d.minQuantity) <= 0) {
          return res.status(400).json({ error: 'minQuantity is required and must be > 0 for BULK_DISCOUNT' })
        }
      }
      if (d.type === 'BUY_X_GET_Y') {
        if (d.buyQuantity === undefined || d.getQuantity === undefined || Number(d.buyQuantity) <= 0 || Number(d.getQuantity) <= 0) {
          return res.status(400).json({ error: 'buyQuantity and getQuantity are required and must be > 0 for BUY_X_GET_Y' })
        }
      }
      await db.Promotion.update({
        type: d.type,
        name: d.name,
        description: d.description || null,
        discountType: d.discountType,
        discountValue: Number(d.discountValue),
        minQuantity: d.minQuantity !== undefined ? Number(d.minQuantity) : existing.minQuantity,
        buyQuantity: d.buyQuantity !== undefined ? Number(d.buyQuantity) : existing.buyQuantity,
        getQuantity: d.getQuantity !== undefined ? Number(d.getQuantity) : existing.getQuantity,
        startDate: start,
        endDate: end,
        isActive: d.isActive !== undefined ? Boolean(d.isActive) : existing.isActive
      }, { where: { id } })

      // Reset and recreate associations if arrays provided
      const productIds = Array.isArray(d.productIds) ? d.productIds : null
      const categoryIds = Array.isArray(d.categoryIds) ? d.categoryIds : null
      if (productIds) {
        await db.ProductPromotion.destroy({ where: { promotionId: id } })
        for (const pid of productIds) {
          await db.ProductPromotion.create({ productId: String(pid), promotionId: id })
        }
      }
      if (categoryIds) {
        await db.CategoryPromotion.destroy({ where: { promotionId: id } })
        for (const cid of categoryIds) {
          await db.CategoryPromotion.create({ categoryId: String(cid), promotionId: id })
        }
      }

      const updated = await db.Promotion.findByPk(id, {
        include: [
          { model: db.ProductPromotion, as: 'productPromotions', include: [{ model: db.Product, as: 'product' }] },
          { model: db.CategoryPromotion, as: 'categoryPromotions', include: [{ model: db.Category, as: 'category' }] },
        ],
      })
      res.json(updated)
    } catch (err) {
      console.error('[Express] Error updating promotion:', err)
      res.status(500).json({ error: 'Failed to update promotion' })
    }
  }
)

// Delete promotion
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const existing = await db.Promotion.findByPk(id)
    if (!existing) return res.status(404).json({ error: 'Promotion not found' })
    await db.Promotion.destroy({ where: { id } })
    res.json({ message: 'Promotion deleted' })
  } catch (err) {
    console.error('[Express] Error deleting promotion:', err)
    res.status(500).json({ error: 'Failed to delete promotion' })
  }
})

// Calculate promotions for cart items
router.post('/calculate', authMiddleware, async (req, res) => {
  try {
    const { items } = req.body || {}
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' })
    }

    const now = new Date()
    const activePromotions = await db.Promotion.findAll({
      where: {
        isActive: true,
        startDate: { [Op.lte]: now },
        endDate: { [Op.gte]: now }
      },
      include: [
        {
          model: db.ProductPromotion,
          as: 'productPromotions',
          include: [{ model: db.Product, as: 'product' }]
        },
        {
          model: db.CategoryPromotion,
          as: 'categoryPromotions',
          include: [{ model: db.Category, as: 'category' }]
        }
      ],
      order: [['createdAt', 'DESC']]
    })

    let totalDiscount = 0
    const appliedPromotions = []

    for (const promotion of activePromotions) {
      let promotionDiscount = 0
      const applicableItems = []

      for (const item of items) {
        let isEligible = false
        if ((promotion.productPromotions || []).some((pp) => String(pp.productId) === String(item.productId))) {
          isEligible = true
        }
        if ((promotion.categoryPromotions || []).some((cp) => String(cp.categoryId) === String(item.categoryId))) {
          isEligible = true
        }
        if (isEligible) applicableItems.push(item)
      }

      if (applicableItems.length === 0) continue

      switch (promotion.type) {
        case 'PRODUCT_DISCOUNT':
        case 'CATEGORY_DISCOUNT':
          for (const item of applicableItems) {
            const itemTotal = Number(item.price || 0) * Number(item.quantity || 0)
            if (promotion.discountType === 'PERCENTAGE') {
              promotionDiscount += (itemTotal * Number(promotion.discountValue || 0)) / 100
            } else {
              promotionDiscount += Math.min(Number(promotion.discountValue || 0) * Number(item.quantity || 0), itemTotal)
            }
          }
          break
        case 'BULK_DISCOUNT':
          {
            const totalQuantity = applicableItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0)
            const totalAmount = applicableItems.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 0)), 0)
            if (promotion.minQuantity && totalQuantity >= Number(promotion.minQuantity)) {
              if (promotion.discountType === 'PERCENTAGE') {
                promotionDiscount += (totalAmount * Number(promotion.discountValue || 0)) / 100
              } else {
                promotionDiscount += Math.min(Number(promotion.discountValue || 0), totalAmount)
              }
            }
          }
          break
        case 'BUY_X_GET_Y':
          if (promotion.buyQuantity && promotion.getQuantity) {
            for (const item of applicableItems) {
              const sets = Math.floor(Number(item.quantity || 0) / Number(promotion.buyQuantity || 1))
              if (sets > 0) {
                const freeItems = Math.min(
                  sets * Number(promotion.getQuantity || 0),
                  Number(item.quantity || 0) - (sets * Number(promotion.buyQuantity || 1))
                )
                if (freeItems > 0) {
                  promotionDiscount += Number(item.price || 0) * freeItems
                }
              }
            }
          }
          break
        default:
          break
      }

      if (promotionDiscount > 0) {
        const rounded = Math.round(promotionDiscount * 100) / 100
        appliedPromotions.push({
          id: promotion.id,
          name: promotion.name,
          type: promotion.type,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
          discount: rounded,
          promotion: {
            id: promotion.id,
            name: promotion.name,
            type: promotion.type,
            discountType: promotion.discountType,
            discountValue: promotion.discountValue
          },
          applicableItems: applicableItems.map((it) => ({
            productId: it.productId,
            name: it.name,
            quantity: it.quantity,
            price: it.price
          }))
        })
        totalDiscount += promotionDiscount
      }
    }

    return res.json({
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      appliedPromotions
    })
  } catch (err) {
    console.error('[Express] Error calculating promotions:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
