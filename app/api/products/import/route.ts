import { NextRequest, NextResponse } from 'next/server'
import db from '@/models'

function splitCSVRow(row: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < row.length; i++) {
    const char = row[i]
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result.map((s) => s.trim())
}

function parseCSV(text: string): { headers: string[], rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }
  const headers = splitCSVRow(lines[0]).map(h => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVRow(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return { headers, rows }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const duplicateStrategy = String(formData.get('duplicateStrategy') || 'skip').toLowerCase()
    const autoCreateCategory = String(formData.get('autoCreateCategory') || 'false') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'File CSV tidak ditemukan' }, { status: 400 })
    }

    const csvText = await file.text()
    const { headers, rows } = parseCSV(csvText)

    if (headers.length === 0 || rows.length === 0) {
      return NextResponse.json({ error: 'CSV kosong atau header tidak valid' }, { status: 400 })
    }

    // Ambil kategori untuk mapping nama->id
    const categories = await db.Category.findAll({ attributes: ['id', 'name'] })
    const categoryNameToId = new Map<string, string>(categories.map((c: any) => [String(c.name).trim().toLowerCase(), c.id]))

    const results: { index: number, status: 'created' | 'skipped' | 'updated' | 'overwritten', error?: string, id?: string }[] = []
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
          const mapped = categoryNameToId.get(key)
          if (mapped) {
            categoryId = String(mapped)
          } else if (autoCreateCategory) {
            try {
              const createdCat = await db.Category.create({ name: categoryName })
              categoryId = String(createdCat.id)
              categoryNameToId.set(key, createdCat.id)
              categories.push(createdCat)
            } catch (catErr: any) {
              // Jika duplikat karena perbedaan case/space, coba ambil ulang
              const fallback = await db.Category.findOne({ where: { name: categoryName } })
              if (fallback) {
                categoryId = String(fallback.id)
                categoryNameToId.set(key, fallback.id)
              } else {
                throw catErr
              }
            }
          }
        }

        const hasIsActiveColumn = headers.some(h => ['isActive', 'aktif'].includes(h))
        const isActiveStr = r.isActive || r.aktif || ''
        const isActive = /^(true|1|ya|aktif)$/i.test(isActiveStr)

        const price = priceStr !== '' ? parseFloat(String(priceStr).replace(/[^0-9.\-]/g, '')) : NaN
        const stock = stockStr !== '' ? parseInt(String(stockStr).replace(/[^0-9\-]/g, '')) : NaN
        const costPrice = costPriceStr !== '' ? parseFloat(String(costPriceStr).replace(/[^0-9.\-]/g, '')) : null

        // Jika tidak ada productCode, generate baru
        let finalProductCode = productCode
        if (!finalProductCode || finalProductCode.trim() === '') {
          const timestamp = Date.now().toString().slice(-6)
          const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
          finalProductCode = `PRD${timestamp}${randomNum}`
        }

        // Cek apakah produk dengan code sudah ada
        const existingProduct = await db.Product.findOne({ where: { productCode: finalProductCode } })

        if (existingProduct) {
          if (duplicateStrategy === 'skip') {
            results.push({ index: i + 1, status: 'skipped', error: 'Kode produk duplikat' })
            skippedCount++
            continue
          }

          const payload: any = {}
          // Required fields: jangan di-clear jika kosong
          if (name.trim() !== '') payload.name = name
          if (Number.isFinite(price)) payload.price = price
          if (size.trim() !== '') payload.size = size
          if (color.trim() !== '') payload.color = color
          if (categoryId && String(categoryId).trim() !== '') payload.categoryId = categoryId

          // Optional: boleh clear pada overwrite
          if (costPriceStr !== '') payload.costPrice = costPrice
          else if (duplicateStrategy === 'overwrite') payload.costPrice = null

          if (!Number.isNaN(stock)) payload.stock = stock
          // description & image
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
          } catch (updErr: any) {
            results.push({ index: i + 1, status: 'skipped', error: updErr?.message || 'Gagal memperbarui produk' })
            skippedCount++
          }
          continue
        }

        // Validasi wajib untuk CREATE
        if (!name || priceStr === '' || !categoryId || !size || !color) {
          results.push({ index: i + 1, status: 'skipped', error: 'Kolom wajib: name, price, categoryId (atau categoryName), size, color' })
          skippedCount++
          continue
        }

        if (!Number.isFinite(price)) {
          results.push({ index: i + 1, status: 'skipped', error: 'Harga tidak valid' })
          skippedCount++
          continue
        }

        // Cek kategori valid (setelah kemungkinan auto-create)
        const categoryExists = categories.find((c: any) => String(c.id) === String(categoryId))
        if (!categoryExists) {
          results.push({ index: i + 1, status: 'skipped', error: 'Kategori tidak ditemukan' })
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
      } catch (rowErr: any) {
        results.push({ index: i + 1, status: 'skipped', error: rowErr?.message || 'Gagal memproses baris' })
        skippedCount++
      }
    }

    return NextResponse.json({
      summary: {
        createdCount,
        updatedCount,
        skippedCount,
        totalRows: rows.length
      },
      results
    })
  } catch (error) {
    console.error('Error import CSV produk:', error)
    return NextResponse.json({ error: 'Gagal mengimpor CSV' }, { status: 500 })
  }
}