const request = require('supertest')
const jwt = require('jsonwebtoken')
const { buildApp } = require('../../../server')
const db = require('../../../../../models')

jest.mock('../../../services/whatsappManager', () => {
  const instance = {
    isConnected: () => true,
    getConnectionStatus: () => ({ isConnected: true, qrCode: null }),
    initialize: jest.fn(),
    sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-456' }),
    disconnect: jest.fn(),
    logout: jest.fn(),
  }
  return { getInstance: jest.fn(() => instance) }
})

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const JWT_AUDIENCE = process.env.JWT_AUD || 'pos-app'
const JWT_ISSUER = process.env.JWT_ISS || 'pos-backend'
function sign(payload) {
  return jwt.sign(payload, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE })
}

describe('WhatsApp send-closure-summary', () => {
  const app = buildApp()
  let user

  beforeAll(async () => {
    await db.sequelize.sync({ force: true })
    user = await db.User.create({ name: 'Cashier', email: 'cashier@example.com', role: 'CASHIER', password: 'pw' })
  })

  afterAll(async () => {
    await db.sequelize.close()
  })

  test('POST /api/v1/whatsapp/send-closure-summary validates inputs', async () => {
    const token = sign({ sub: user.id, role: 'CASHIER', email: user.email })
    const res = await request(app)
      .post('/api/v1/whatsapp/send-closure-summary')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
  })

  test('POST /api/v1/whatsapp/send-closure-summary happy path', async () => {
    const token = sign({ sub: user.id, role: 'CASHIER', email: user.email })
    const report = {
      shiftId: 'S-1',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      openingBalance: 100000,
      cashSales: 250000,
      totalTransactions: 350000,
      systemExpectedCash: 450000,
      physicalCash: 450000,
      difference: 0,
      paymentBreakdown: { CASH: { total: 250000, count: 5 } },
      statusCounts: { COMPLETED: 5 },
      discountTotals: { discount: 0, voucherDiscount: 0, promoDiscount: 0, tax: 0 },
      pointsTotals: { earned: 0, used: 0 },
      itemsSold: 5,
      logs: [{ action: 'close', createdAt: new Date().toISOString() }],
    }
    const res = await request(app)
      .post('/api/v1/whatsapp/send-closure-summary')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: '081234567890', report })
    expect(res.status).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.messageId).toBe('msg-456')
  })
})