const request = require('supertest')
const jwt = require('jsonwebtoken')
const { buildApp } = require('../../../server')
const db = require('../../../../../models')

jest.mock('../../../services/whatsappManager', () => {
  const instance = {
    isConnected: () => true,
    getConnectionStatus: () => ({ isConnected: true, qrCode: null }),
    initialize: jest.fn(),
    sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-123' }),
    disconnect: jest.fn(),
    logout: jest.fn(),
  }
  return { getInstance: jest.fn(() => instance) }
})

const WhatsAppManager = require('../../../services/whatsappManager')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const JWT_AUDIENCE = process.env.JWT_AUD || 'pos-app'
const JWT_ISSUER = process.env.JWT_ISS || 'pos-backend'
function sign(payload) {
  return jwt.sign(payload, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE })
}

describe('WhatsApp send-receipt', () => {
  const app = buildApp()

  beforeAll(async () => {
    await db.sequelize.sync({ force: true })
    const user = await db.User.create({ name: 'Admin', email: 'admin@example.com', password: 'secret', role: 'CASHIER' })
    const category = await db.Category.create({ name: 'Pakaian' })
    const product = await db.Product.create({ name: 'Kaos', price: 50000, color: 'Hitam', size: 'M', categoryId: category.id, productCode: 'KAOS-01' })
    const trx = await db.Transaction.create({
      total: 50000,
      tax: 0,
      finalTotal: 50000,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      customerName: 'Budi',
      userId: user.id,
    })
    await db.TransactionItem.create({ transactionId: trx.id, productId: product.id, quantity: 1, price: 50000, subtotal: 50000 })
  })

  test('POST /api/v1/whatsapp/send-receipt validates inputs', async () => {
    const token = sign({ sub: 'u3', role: 'CASHIER' })
    const res = await request(app)
      .post('/api/v1/whatsapp/send-receipt')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
  })

  test('POST /api/v1/whatsapp/send-receipt happy path', async () => {
    const trx = await db.Transaction.findOne()
    const token = sign({ sub: 'u4', role: 'CASHIER' })
    const res = await request(app)
      .post('/api/v1/whatsapp/send-receipt')
      .set('Authorization', `Bearer ${token}`)
      .send({ transactionId: trx.id, phoneNumber: '081234567890' })
    expect(res.status).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.messageId).toBe('msg-123')
    expect(WhatsAppManager.getInstance).toHaveBeenCalled()
  })
})