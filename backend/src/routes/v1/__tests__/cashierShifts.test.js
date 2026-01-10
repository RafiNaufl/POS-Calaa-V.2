const request = require('supertest')
const jwt = require('jsonwebtoken')
const { buildApp } = require('../../../server')
const db = require('../../../../../models')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const JWT_AUDIENCE = process.env.JWT_AUD || 'pos-app'
const JWT_ISSUER = process.env.JWT_ISS || 'pos-backend'

const token = jwt.sign({ sub: 'test-user', email: 'test@example.com' }, JWT_SECRET, { audience: JWT_AUDIENCE, issuer: JWT_ISSUER })

describe('Cashier Shifts API', () => {
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

  it('returns 401 without token', async () => {
    await request(app).get('/api/v1/cashier-shifts').expect(401)
  })

  it('lists shifts 200 with token', async () => {
    await request(app).get('/api/v1/cashier-shifts').set('Authorization', `Bearer ${token}`).expect(200)
  })

  it('get unknown id returns 404', async () => {
    await request(app).get('/api/v1/cashier-shifts/not-found').set('Authorization', `Bearer ${token}`).expect(404)
  })

  it('validate create shift payload (missing requireds) -> 400', async () => {
    await request(app)
      .post('/api/v1/cashier-shifts')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  it('validate update shift payload (missing endedAt) -> 400', async () => {
    await request(app)
      .put('/api/v1/cashier-shifts/any-id')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  it('delete without token returns 401', async () => {
    await request(app).delete('/api/v1/cashier-shifts/any-id').expect(401)
  })
})