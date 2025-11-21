'use strict'

const path = require('path')
const dotenv = require('dotenv')
// Muat env untuk koneksi DB aplikasi
try {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
  dotenv.config({ path: path.resolve(process.cwd(), '.env') })
} catch {}

const db = require('../models')
const { Op } = require('sequelize')

async function deleteMemberByName(name) {
  const target = await db.Member.findOne({
    where: { name: { [Op.iLike]: name } }
  })
  if (!target) return { entity: 'Member', name, status: 'not_found' }
  const related = await db.Transaction.count({ where: { memberId: target.id } })
  if (related > 0) {
    return { entity: 'Member', name, status: 'blocked', reason: 'Ada transaksi terkait' }
  }
  await db.Member.destroy({ where: { id: target.id } })
  return { entity: 'Member', name, status: 'deleted', id: target.id }
}

async function deleteProductByName(name) {
  const target = await db.Product.findOne({
    where: { name: { [Op.iLike]: name } }
  })
  if (!target) return { entity: 'Product', name, status: 'not_found' }
  const related = await db.TransactionItem.count({ where: { productId: target.id } })
  if (related > 0) {
    return { entity: 'Product', name, status: 'blocked', reason: 'Ada transaksi terkait' }
  }
  await db.Product.destroy({ where: { id: target.id } })
  return { entity: 'Product', name, status: 'deleted', id: target.id }
}

async function deleteCategoryByName(name) {
  const target = await db.Category.findOne({
    where: { name: { [Op.iLike]: name } }
  })
  if (!target) return { entity: 'Category', name, status: 'not_found' }
  const productCount = await db.Product.count({ where: { categoryId: target.id } })
  if (productCount > 0) {
    return { entity: 'Category', name, status: 'blocked', reason: `Masih memiliki ${productCount} produk` }
  }
  await db.Category.destroy({ where: { id: target.id } })
  return { entity: 'Category', name, status: 'deleted', id: target.id }
}

async function main() {
  const cfg = db.sequelize.config || {}
  console.log('[Admin Delete] Connecting:', {
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    username: cfg.username,
    dialect: db.sequelize.getDialect(),
  })

  await db.sequelize.authenticate()
  console.log('[Admin Delete] Connection OK')

  const targets = {
    members: ['budi'],
    products: ['teh botol', 'produk dummy', 'testing produk'],
    categories: ['minuman', 'testing'],
  }

  const results = []

  for (const name of targets.members) {
    try { results.push(await deleteMemberByName(name)) } catch (e) { results.push({ entity: 'Member', name, status: 'error', reason: e.message }) }
  }
  for (const name of targets.products) {
    try { results.push(await deleteProductByName(name)) } catch (e) { results.push({ entity: 'Product', name, status: 'error', reason: e.message }) }
  }
  for (const name of targets.categories) {
    try { results.push(await deleteCategoryByName(name)) } catch (e) { results.push({ entity: 'Category', name, status: 'error', reason: e.message }) }
  }

  console.log('[Admin Delete] Summary:')
  for (const r of results) {
    console.log(`- ${r.entity} "${r.name}": ${r.status}${r.reason ? ` (${r.reason})` : ''}${r.id ? ` [id=${r.id}]` : ''}`)
  }

  await db.sequelize.close().catch(() => {})
  console.log('[Admin Delete] Done')
}

main().catch(async (err) => {
  console.error('[Admin Delete] Failed:', err)
  try { await db.sequelize.close() } catch {}
  process.exit(1)
})