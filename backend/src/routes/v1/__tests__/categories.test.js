const request = require('supertest')
const jwt = require('jsonwebtoken')
const { buildApp } = require('../../../server')
const db = require('../../../../../models')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const JWT_AUDIENCE = process.env.JWT_AUD || 'pos-app'
const JWT_ISSUER = process.env.JWT_ISS || 'pos-backend'

const token = jwt.sign({ sub: 'test-user', email: 'test@example.com' }, JWT_SECRET, { audience: JWT_AUDIENCE, issuer: JWT_ISSUER })

describe('Categories API', () => {
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
    await request(app).get('/api/v1/categories').expect(401)
  })

  it('lists categories 200 with token', async () => {
    await request(app).get('/api/v1/categories').set('Authorization', `Bearer ${token}`).expect(200)
  })

  it('get unknown id returns 404', async () => {
    await request(app).get('/api/v1/categories/not-found').set('Authorization', `Bearer ${token}`).expect(404)
  })

  it('validate create category payload (missing name) -> 400', async () => {
    await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  it('validate update category payload (missing name) -> 400', async () => {
    await request(app)
      .put('/api/v1/categories/any-id')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  it('delete without token returns 401', async () => {
    await request(app).delete('/api/v1/categories/any-id').expect(401)
  })

  it('creates a category -> 201 and returns entity', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Beverages', description: 'Drinks' })
      .expect(201)
    expect(res.body.id).toBeTruthy()
    expect(res.body.name).toBe('Beverages')
  })

  it('updates a category -> 200 and persists changes', async () => {
    const created = await db.Category.create({ name: 'Snacks', description: 'Old' })
    const res = await request(app)
      .put(`/api/v1/categories/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Snacks', description: 'Updated' })
      .expect(200)
    expect(res.body.description).toBe('Updated')
  })

  it('deletes a category -> 200 with message', async () => {
    const toDelete = await db.Category.create({ name: 'ToDelete' })
    const res = await request(app)
      .delete(`/api/v1/categories/${toDelete.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.message).toMatch(/deleted/i)
  })
})