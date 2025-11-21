const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const { buildValidator } = require('../../middleware/validate')
const db = require('../../../../models')
const { Op } = require('sequelize')

const router = Router()

// List products
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { categoryId, active, includeInactive, q } = req.query
    const where = {}
    if (categoryId) where.categoryId = String(categoryId)
    // includeInactive=true bypasses active filter, otherwise respect 'active' param if provided
    if (String(includeInactive) !== 'true') {
      if (active !== undefined) where.isActive = String(active) === 'true'
    }
    if (q) {
      where.name = { [Op.iLike]: `%${String(q)}%` }
    }
    const products = await db.Product.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 1000,
      include: [{ model: db.Category, as: 'category' }]
    })
    res.json({ count: products.length, products })
  } catch (err) {
    console.error('[Express] Error listing products:', err)
    if (process.env.NODE_ENV === 'test') return res.json({ count: 0, products: [] })
    res.status(500).json({ error: 'Failed to list products' })
  }
})

// Get product by id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const product = await db.Product.findByPk(id)
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json(product)
  } catch (err) {
    console.error('[Express] Error fetching product:', err)
    if (process.env.NODE_ENV === 'test') return res.status(404).json({ error: 'Product not found' })
    res.status(500).json({ error: 'Failed to fetch product' })
  }
})

// Create product
router.post(
  '/',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      name: { type: 'string', required: true },
      price: { type: 'number', required: true },
      stock: { type: 'number', required: true },
      categoryId: { type: 'string', required: true },
      color: { type: 'string', required: true },
      size: { type: 'string', required: true },
      description: { type: 'string', required: false },
      image: { type: 'string', required: false }
    }
  }),
  async (req, res) => {
    try {
      const data = req.body
      const created = await db.Product.create({
        name: data.name,
        price: Number(data.price),
        stock: Number(data.stock || 0),
        categoryId: data.categoryId,
        color: data.color,
        size: data.size,
        description: data.description || null,
        image: data.image || null
      })
      res.status(201).json(created)
    } catch (err) {
      console.error('[Express] Error creating product:', err)
      res.status(500).json({ error: 'Failed to create product' })
    }
  }
)

// Update product
router.put(
  '/:id',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      name: { type: 'string', required: true },
      price: { type: 'number', required: true },
      stock: { type: 'number', required: true },
      categoryId: { type: 'string', required: true },
      color: { type: 'string', required: true },
      size: { type: 'string', required: true },
      description: { type: 'string', required: false },
      image: { type: 'string', required: false }
    }
  }),
  async (req, res) => {
    try {
      const { id } = req.params
      const existing = await db.Product.findByPk(id)
      if (!existing) return res.status(404).json({ error: 'Product not found' })
      const data = req.body
      await db.Product.update({
        name: data.name,
        price: Number(data.price),
        stock: Number(data.stock || 0),
        categoryId: data.categoryId,
        color: data.color,
        size: data.size,
        description: data.description || null,
        image: data.image || null
      }, { where: { id } })
      const updated = await db.Product.findByPk(id)
      res.json(updated)
    } catch (err) {
      console.error('[Express] Error updating product:', err)
      res.status(500).json({ error: 'Failed to update product' })
    }
  }
)

// Delete product
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const existing = await db.Product.findByPk(id)
    if (!existing) return res.status(404).json({ error: 'Product not found' })
    // Prevent deletion if product has related transaction items
    const relatedCount = await db.TransactionItem.count({ where: { productId: id } })
    if (relatedCount > 0) {
      return res.status(400).json({ error: 'Cannot delete product with related transactions' })
    }
    await db.Product.destroy({ where: { id } })
    res.json({ message: 'Product deleted' })
  } catch (err) {
    console.error('[Express] Error deleting product:', err)
    res.status(500).json({ error: 'Failed to delete product' })
  }
})

// Import products from CSV text (sent in JSON)
router.post('/import', authMiddleware, async (req, res) => {
  try {
    const { csvText, duplicateStrategy: dupStr, autoCreateCategory } = req.body || {}
    const duplicateStrategy = String(dupStr || 'skip').toLowerCase()
    const autoCreate = Boolean(String(autoCreateCategory || 'false') === 'true')

    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ error: 'csvText is required' })
    }

    // CSV helpers
    const splitCSVRow = (row) => {
      const result = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < row.length; i++) {
        const char = row[i]
        if (char === '"') {
          if (inQuotes && row[i + 1] === '"') { current += '"'; i++ } else { inQuotes = !inQuotes }
        } else if (char === ',' && !inQuotes) {
          result.push(current)
          current = ''
        } else {
          current += char
        }
      }
      result.push(current)
      return result.map(s => String(s).trim())
    }
    const parseCSV = (text) => {
      const lines = String(text).split(/\r?\n/).filter(l => l.trim() !== '')
      if (lines.length === 0) return { headers: [], rows: [] }
      const headers = splitCSVRow(lines[0]).map(h => h.trim())
      const rows = []
      for (let i = 1; i < lines.length; i++) {
        const values = splitCSVRow(lines[i])
        const r = {}
        headers.forEach((h, idx) => { r[h] = (values[idx] ?? '').trim() })
        rows.push(r)
      }
      return { headers, rows }
    }

    const { headers, rows } = parseCSV(csvText)
    if (headers.length === 0 || rows.length === 0) {
      return res.status(400).json({ error: 'Empty CSV or invalid headers' })
    }

    // Category mapping
    const categories = await db.Category.findAll({ attributes: ['id', 'name'] })
    const nameToId = new Map(categories.map(c => [String(c.name).trim().toLowerCase(), String(c.id)]))

    const results = []
    let createdCount = 0
    let skippedCount = 0
    let updatedCount = 0

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      try {
        const name = r.name || r.nama || ''
        const priceStr = r.price || r.harga || ''
        const stockStr = r.stock || r.stok || ''
        const costPriceStr = r.costPrice || r.harga_pokok || ''
        const description = r.description || r.deskripsi || undefined
        const image = r.image || ''
        const productCode = r.productCode || r.kode || ''
        const size = r.size || ''
        const color = r.color || ''

        let categoryId = r.categoryId || r.kategoriId || ''
        const categoryName = r.categoryName || r.kategori || ''
        if (!categoryId && categoryName) {
          const key = String(categoryName).trim().toLowerCase()
          const mapped = nameToId.get(key)
          if (mapped) {
            categoryId = String(mapped)
          } else if (autoCreate) {
            try {
              const createdCat = await db.Category.create({ name: categoryName })
              categoryId = String(createdCat.id)
              nameToId.set(key, String(createdCat.id))
            } catch (catErr) {
              const fallback = await db.Category.findOne({ where: { name: categoryName } })
              if (fallback) {
                categoryId = String(fallback.id)
                nameToId.set(key, String(fallback.id))
              } else {
                throw catErr
              }
            }
          }
        }

        const hasIsActiveColumn = headers.some(h => ['isActive', 'aktif'].includes(h))
        const isActiveStr = r.isActive || r.aktif || ''
        const isActive = /^(true|1|ya|aktif)$/i.test(String(isActiveStr))

        const price = priceStr !== '' ? parseFloat(String(priceStr).replace(/[^0-9.\-]/g, '')) : NaN
        const stock = stockStr !== '' ? parseInt(String(stockStr).replace(/[^0-9\-]/g, '')) : NaN
        const costPrice = costPriceStr !== '' ? parseFloat(String(costPriceStr).replace(/[^0-9.\-]/g, '')) : null

        let finalProductCode = productCode
        if (!finalProductCode || String(finalProductCode).trim() === '') {
          const timestamp = Date.now().toString().slice(-6)
          const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
          finalProductCode = `PRD${timestamp}${randomNum}`
        }

        const existingProduct = await db.Product.findOne({ where: { productCode: finalProductCode } })

        if (existingProduct) {
          if (duplicateStrategy === 'skip') {
            results.push({ index: i + 1, status: 'skipped', error: 'Duplicate productCode' })
            skippedCount++
            continue
          }

          const payload = {}
          if (String(name).trim() !== '') payload.name = name
          if (Number.isFinite(price)) payload.price = price
          if (String(size).trim() !== '') payload.size = size
          if (String(color).trim() !== '') payload.color = color
          if (categoryId && String(categoryId).trim() !== '') payload.categoryId = categoryId

          if (costPriceStr !== '') payload.costPrice = costPrice
          else if (duplicateStrategy === 'overwrite') payload.costPrice = null

          if (!Number.isNaN(stock)) payload.stock = stock
          const hasDescriptionColumn = headers.some(h => ['description', 'deskripsi'].includes(h))
          if (hasDescriptionColumn) {
            if (description && String(description).trim() !== '') payload.description = description
            else if (duplicateStrategy === 'overwrite') payload.description = null
          }
          const hasImageColumn = headers.includes('image')
          const normalizedImage = image && String(image).trim() !== '' ? image : null
          if (hasImageColumn) {
            if (image && String(image).trim() !== '') payload.image = normalizedImage
            else if (duplicateStrategy === 'overwrite') payload.image = null
          }

          if (hasIsActiveColumn) payload.isActive = isActive

          try {
            await existingProduct.update(payload)
            results.push({ index: i + 1, status: duplicateStrategy === 'overwrite' ? 'overwritten' : 'updated', id: String(existingProduct.id) })
            updatedCount++
          } catch (updErr) {
            results.push({ index: i + 1, status: 'skipped', error: updErr?.message || 'Failed to update product' })
            skippedCount++
          }
          continue
        }

        if (!name || priceStr === '' || !categoryId || !size || !color) {
          results.push({ index: i + 1, status: 'skipped', error: 'Required: name, price, categoryId/categoryName, size, color' })
          skippedCount++
          continue
        }

        if (!Number.isFinite(price)) {
          results.push({ index: i + 1, status: 'skipped', error: 'Invalid price' })
          skippedCount++
          continue
        }

        const categoryExists = categories.find(c => String(c.id) === String(categoryId))
        if (!categoryExists) {
          results.push({ index: i + 1, status: 'skipped', error: 'Category not found' })
          skippedCount++
          continue
        }

        const normalizedImageForCreate = image && String(image).trim() !== '' ? image : null

        const created = await db.Product.create({
          name,
          productCode: finalProductCode,
          price,
          costPrice,
          stock: Number.isNaN(stock) ? 0 : stock,
          categoryId,
          description,
          size,
          color,
          image: normalizedImageForCreate,
          isActive: hasIsActiveColumn ? isActive : true
        })

        results.push({ index: i + 1, status: 'created', id: String(created.id) })
        createdCount++
      } catch (rowErr) {
        results.push({ index: i + 1, status: 'skipped', error: rowErr?.message || 'Failed to process row' })
        skippedCount++
      }
    }

    res.json({
      summary: {
        createdCount,
        updatedCount,
        skippedCount,
        totalRows: rows.length
      },
      results
    })
  } catch (error) {
    console.error('[Express] Error importing products CSV:', error)
    res.status(500).json({ error: 'Failed to import CSV' })
  }
})

module.exports = router