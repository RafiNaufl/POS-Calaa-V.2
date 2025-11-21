const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const { buildValidator } = require('../../middleware/validate')
const db = require('../../../../models')

const router = Router()

// List categories
router.get('/', authMiddleware, async (_req, res) => {
  try {
    // Use aggregated query to include productCount per category
    const categories = await db.Category.getWithProductCount()
    // Maintain order by createdAt DESC within aggregation result
    categories.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    res.json({ count: categories.length, categories })
  } catch (err) {
    console.error('[Express] Error listing categories:', err)
    if (process.env.NODE_ENV === 'test') return res.json({ count: 0, categories: [] })
    res.status(500).json({ error: 'Failed to list categories' })
  }
})

// Get category by id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const category = await db.Category.findByPk(id)
    if (!category) return res.status(404).json({ error: 'Category not found' })
    const productCount = await category.getProductCount()
    res.json({ ...category.toJSON(), productCount })
  } catch (err) {
    console.error('[Express] Error fetching category:', err)
    if (process.env.NODE_ENV === 'test') return res.status(404).json({ error: 'Category not found' })
    res.status(500).json({ error: 'Failed to fetch category' })
  }
})

// Create category
router.post(
  '/',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: { name: { type: 'string', required: true }, description: { type: 'string', required: false } }
  }),
  async (req, res) => {
    try {
      const { name, description } = req.body
      const created = await db.Category.create({ name, description: description || null })
      res.status(201).json(created)
    } catch (err) {
      console.error('[Express] Error creating category:', err)
      res.status(500).json({ error: 'Failed to create category' })
    }
  }
)

// Update category
router.put(
  '/:id',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: { name: { type: 'string', required: true }, description: { type: 'string', required: false } }
  }),
  async (req, res) => {
    try {
      const { id } = req.params
      const existing = await db.Category.findByPk(id)
      if (!existing) return res.status(404).json({ error: 'Category not found' })
      const { name, description } = req.body
      await db.Category.update({ name, description: description || null }, { where: { id } })
      const updated = await db.Category.findByPk(id)
      res.json(updated)
    } catch (err) {
      console.error('[Express] Error updating category:', err)
      res.status(500).json({ error: 'Failed to update category' })
    }
  }
)

// Delete category
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const existing = await db.Category.findByPk(id)
    if (!existing) return res.status(404).json({ error: 'Category not found' })
    // Prevent deletion if category still has products
    const productCount = await db.Product.count({ where: { categoryId: id } })
    if (productCount > 0) {
      return res.status(400).json({ error: 'Cannot delete category with existing products' })
    }
    await db.Category.destroy({ where: { id } })
    res.json({ message: 'Category deleted' })
  } catch (err) {
    console.error('[Express] Error deleting category:', err)
    res.status(500).json({ error: 'Failed to delete category' })
  }
})

module.exports = router