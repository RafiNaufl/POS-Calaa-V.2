const request = require('supertest')
const jwt = require('jsonwebtoken')
const { buildApp } = require('../../../server')
const db = require('../../../../../models')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const JWT_AUDIENCE = process.env.JWT_AUD || 'pos-app'
const JWT_ISSUER = process.env.JWT_ISS || 'pos-backend'

const token = jwt.sign({ sub: 'test-user', email: 'test@example.com' }, JWT_SECRET, { audience: JWT_AUDIENCE, issuer: JWT_ISSUER })

describe('Promotions API', () => {
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
    await request(app).get('/api/v1/promotions').expect(401)
  })

  it('lists promotions 200 with token', async () => {
    await request(app).get('/api/v1/promotions').set('Authorization', `Bearer ${token}`).expect(200)
  })

  it('get unknown id returns 404', async () => {
    await request(app).get('/api/v1/promotions/not-found').set('Authorization', `Bearer ${token}`).expect(404)
  })

  it('validate create promotion payload (missing requireds) -> 400', async () => {
    await request(app)
      .post('/api/v1/promotions')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  it('validate update promotion payload (missing requireds) -> 400', async () => {
    await request(app)
      .put('/api/v1/promotions/any-id')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  it('delete without token returns 401', async () => {
    await request(app).delete('/api/v1/promotions/any-id').expect(401)
  })

  it('creates a promotion -> 201 and returns entity', async () => {
    const payload = {
      type: 'PRODUCT_DISCOUNT',
      name: 'Holiday Sale',
      discountType: 'PERCENTAGE',
      discountValue: '15',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      isActive: true
    }
    const res = await request(app)
      .post('/api/v1/promotions')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201)
    expect(res.body.id).toBeTruthy()
    expect(res.body.discountType).toBe('PERCENTAGE')
    expect(res.body.type).toBe('PRODUCT_DISCOUNT')
  })

  it('rejects invalid enum discountType at validator -> 400', async () => {
    const payload = {
      type: 'PRODUCT_DISCOUNT', name: 'Bad', discountType: 'NOT_VALID', discountValue: 10,
      startDate: new Date().toISOString(), endDate: new Date(Date.now() + 86400000).toISOString()
    }
    await request(app)
      .post('/api/v1/promotions')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(400)
  })

  it('rejects invalid date string at validator -> 400', async () => {
    const payload = {
      type: 'PRODUCT_DISCOUNT', name: 'Bad Dates', discountType: 'PERCENTAGE', discountValue: 5,
      startDate: 'not-a-date', endDate: 'still-not-a-date'
    }
    await request(app)
      .post('/api/v1/promotions')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(400)
  })

  it('updates a promotion -> 200 and persists changes', async () => {
    const created = await db.Promotion.create({
      type: 'CATEGORY_DISCOUNT', name: 'Upd', discountType: 'FIXED', discountValue: 5,
      startDate: new Date(), endDate: new Date(Date.now() + 86400000), isActive: true
    })
    const res = await request(app)
      .put(`/api/v1/promotions/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'CATEGORY_DISCOUNT', name: 'Updated Promotion', discountType: 'FIXED', discountValue: 7.5,
        startDate: new Date().toISOString(), endDate: new Date(Date.now() + 172800000).toISOString(), isActive: true
      })
      .expect(200)
    expect(res.body.discountValue).toBe(7.5)
    expect(res.body.name).toBe('Updated Promotion')
  })

  it('deletes a promotion -> 200 with message', async () => {
    const toDelete = await db.Promotion.create({
      type: 'BULK_DISCOUNT', name: 'Del', discountType: 'PERCENTAGE', discountValue: 10,
      startDate: new Date(), endDate: new Date(Date.now() + 86400000), isActive: true
    })
    const res = await request(app)
      .delete(`/api/v1/promotions/${toDelete.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.message).toMatch(/deleted/i)
  })
})