const request = require('supertest')
const jwt = require('jsonwebtoken')
const { buildApp } = require('../../../server')
const db = require('../../../../../models')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const JWT_AUDIENCE = process.env.JWT_AUD || 'pos-app'
const JWT_ISSUER = process.env.JWT_ISS || 'pos-backend'

const token = jwt.sign({ sub: 'test-user', email: 'test@example.com', role: 'ADMIN' }, JWT_SECRET, { audience: JWT_AUDIENCE, issuer: JWT_ISSUER })

describe('Operational Expenses API', () => {
  const app = buildApp()

  beforeAll(async () => {
    await db.sequelize.sync({ force: true })
    await db.User.create({
      name: 'Test User',
      email: 'test@example.com',
      role: 'ADMIN',
      password: 'password123'
    })
  })

  afterAll(async () => {
    await db.sequelize.close()
  })

  it('rejects unauthorized requests', async () => {
    const res = await request(app).get('/api/v1/operational-expenses')
    expect(res.status).toBe(401)
  })

  it('validates create payload', async () => {
    const res = await request(app)
      .post('/api/v1/operational-expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Paper', category: 'SUPPLIES' })
    expect(res.status).toBe(400)
  })
})