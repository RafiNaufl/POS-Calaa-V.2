const request = require('supertest')
const jwt = require('jsonwebtoken')
const { buildApp } = require('../../../server')
const db = require('../../../models')

// Use defaults from auth middleware or environment
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const JWT_AUDIENCE = process.env.JWT_AUD || 'pos-app'
const JWT_ISSUER = process.env.JWT_ISS || 'pos-backend'

const token = jwt.sign(
  { sub: 'test-user', role: 'ADMIN', email: 'test@example.com' },
  JWT_SECRET,
  { audience: JWT_AUDIENCE, issuer: JWT_ISSUER }
)

describe('Payments API', () => {
  const app = buildApp()

  beforeAll(async () => {
    // Reset database
    await db.sequelize.sync({ force: true })
    
    // Create a test user for authentication
    await db.User.create({
      email: 'test@example.com',
      role: 'ADMIN',
      name: 'Test Admin',
      password: 'password123'
    })
  })

  afterAll(async () => {
    await db.sequelize.close()
  })

  it('returns 401 without token', async () => {
    await request(app).get('/api/v1/payments').expect(401)
  })

  it('lists payments 200 with token', async () => {
    await request(app).get('/api/v1/payments').set('Authorization', `Bearer ${token}`).expect(200)
  })

  it('get unknown id returns 404', async () => {
    await request(app).get('/api/v1/payments/not-found').set('Authorization', `Bearer ${token}`).expect(404)
  })

  it('validate create payment payload (missing requireds) -> 400', async () => {
    await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  it('validate update payment payload (missing requireds) -> 400', async () => {
    await request(app)
      .put('/api/v1/payments/any-id')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  it('delete without token returns 401', async () => {
    await request(app).delete('/api/v1/payments/any-id').expect(401)
  })

  it('checks qris confirm route existence (should not be 404)', async () => {
    // Should return 400 because transactionId is missing, NOT 404
    await request(app)
      .post('/api/v1/payments/qris/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })
})