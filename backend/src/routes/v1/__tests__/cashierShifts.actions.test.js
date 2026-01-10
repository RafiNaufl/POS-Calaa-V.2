const request = require('supertest')
const jwt = require('jsonwebtoken')
const { buildApp } = require('../../../server')
const db = require('../../../../../models')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const JWT_AUDIENCE = process.env.JWT_AUD || 'pos-app'
const JWT_ISSUER = process.env.JWT_ISS || 'pos-backend'

// Sign token with numeric id to satisfy authMiddleware checks
const token = jwt.sign({ id: 1, role: 'CASHIER', email: 'kasir1@example.com' }, JWT_SECRET, { audience: JWT_AUDIENCE, issuer: JWT_ISSUER })

describe('Cashier Shifts Actions API', () => {
  const app = buildApp()

  beforeAll(async () => {
    await db.sequelize.sync({ force: true })
    // Seed a user required by actions endpoints
    await db.User.create({ id: 1, name: 'Kasir Satu', email: 'kasir1@example.com', role: 'CASHIER', password: 'secret' })

    // Seed minimal category and product for TransactionItem association
    const category = await db.Category.create({ id: 'C1', name: 'Test Category' })
    await db.Product.create({ id: 'P1', name: 'Test Product', price: 5000, stock: 10, categoryId: category.id, color: 'RED', size: 'M' })
  })

  afterAll(async () => {
    await db.sequelize.close()
  })

  it('opens a shift with valid openingBalance', async () => {
    const res = await request(app)
      .post('/api/v1/cashier-shifts/open')
      .set('Authorization', `Bearer ${token}`)
      .send({ openingBalance: 50000 })
      .expect(200)

    expect(res.body.shift).toBeDefined()
    expect(res.body.shift.status).toBe('OPEN')
    expect(Number(res.body.shift.openingBalance)).toBe(50000)
    expect(res.body.shift.userId).toBe(1)
  })

  it('blocks closing when there are PENDING transactions', async () => {
    // Create a pending transaction belonging to the cashier
    await db.Transaction.create({
      userId: 1,
      status: 'PENDING',
      total: 15000,
      finalTotal: 15000,
      paymentMethod: 'CASH'
    })

    const res = await request(app)
      .post('/api/v1/cashier-shifts/close')
      .set('Authorization', `Bearer ${token}`)
      .send({ closingBalance: 65000 })
      .expect(400)

    expect(res.body.error).toMatch(/PENDING/)
  })

  it('returns current open shift', async () => {
    const res = await request(app)
      .get('/api/v1/cashier-shifts/current')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.shift).toBeDefined()
    expect(res.body.shift.status).toBe('OPEN')
    expect(res.body.shift.userId).toBe(1)
  })

  it('closes shift after resolving PENDING and computes aggregation', async () => {
    // Resolve pending: mark as CANCELLED
    await db.Transaction.update({ status: 'CANCELLED' }, { where: { userId: 1, status: 'PENDING' } })

    // Create a COMPLETED cash transaction within the shift window
    const txn = await db.Transaction.create({
      userId: 1,
      status: 'COMPLETED',
      total: 10000,
      finalTotal: 10000,
      paymentMethod: 'CASH',
      voucherDiscount: 0,
      promoDiscount: 0,
      discount: 0,
      tax: 0,
      pointsEarned: 0,
      pointsUsed: 0,
    })

    // Add items to reflect itemsSold aggregation
    await db.TransactionItem.create({ transactionId: txn.id, productId: 'P1', quantity: 2, price: 5000, subtotal: 10000 })

    const res = await request(app)
      .post('/api/v1/cashier-shifts/close')
      .set('Authorization', `Bearer ${token}`)
      .send({ closingBalance: 60000 })
      .expect(200)

    expect(res.body.report).toBeDefined()
    const report = res.body.report

    // Aggregation checks
    expect(report.cashierId).toBe(1)
    expect(report.openingBalance).toBe(50000)
    expect(report.cashSales).toBe(10000)
    expect(report.totalTransactions).toBe(10000)
    expect(report.systemExpectedCash).toBe(60000) // opening (50000) + cashTotal (10000)
    expect(report.physicalCash).toBe(60000)
    expect(report.difference).toBe(0)

    // Payment breakdown
    expect(report.paymentBreakdown).toBeDefined()
    expect(report.paymentBreakdown.CASH.total).toBe(10000)
    expect(report.paymentBreakdown.CASH.count).toBe(1)

    // Status counts should reflect one COMPLETED, one CANCELLED, zero pending
    expect(report.statusCounts.COMPLETED).toBeGreaterThanOrEqual(1)
    expect(report.statusCounts.CANCELLED).toBeGreaterThanOrEqual(1)
    expect(report.statusCounts.PENDING).toBe(0)

    // Items sold aggregated
    expect(report.itemsSold).toBeGreaterThanOrEqual(2)

    // Logs present: OPEN_SHIFT and CLOSE_SHIFT
    const actions = report.logs.map(l => l.action)
    expect(actions).toContain('OPEN_SHIFT')
    expect(actions).toContain('CLOSE_SHIFT')
  })
})