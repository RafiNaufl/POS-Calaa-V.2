const request = require('supertest')
const jwt = require('jsonwebtoken')
const { buildApp } = require('../../../server')
const db = require('../../../../../models')

const token = jwt.sign({ sub: 'test-user' }, 'dev-secret', { audience: 'pos-app', issuer: 'pos-backend' })

describe('Products API', () => {
  const app = buildApp()
  let category

  beforeAll(async () => {
    await db.sequelize.sync({ force: true })
    category = await db.Category.create({ name: 'Electronics' })
  })

  it('returns 401 without token', async () => {
    await request(app).get('/api/v1/products').expect(401)
  })

  it('lists products 200 with token', async () => {
    await request(app).get('/api/v1/products').set('Authorization', `Bearer ${token}`).expect(200)
  })

  it('get unknown id returns 404', async () => {
    await request(app).get('/api/v1/products/not-found').set('Authorization', `Bearer ${token}`).expect(404)
  })

  it('validate create product payload (missing requireds) -> 400', async () => {
    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'OnlyName' })
      .expect(400)
  })

  it('validate update product payload (missing requireds) -> 400', async () => {
    await request(app)
      .put('/api/v1/products/any-id')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  it('delete without token returns 401', async () => {
    await request(app).delete('/api/v1/products/any-id').expect(401)
  })

  it('creates a product -> 201 and returns entity', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Headphones',
        price: 99.99,
        stock: 10,
        categoryId: category.id,
        color: 'Black',
        size: 'Standard'
      })
      .expect(201)
    expect(res.body.id).toBeTruthy()
    expect(res.body.categoryId).toBe(category.id)
  })

  it('updates a product -> 200 and persists changes', async () => {
    const created = await db.Product.create({
      name: 'Mouse', price: 25, stock: 50, categoryId: category.id, color: 'Gray', size: 'S'
    })
    const res = await request(app)
      .put(`/api/v1/products/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Mouse', price: 30, stock: 60, categoryId: category.id, color: 'Gray', size: 'S'
      })
      .expect(200)
    expect(res.body.price).toBe(30)
    expect(res.body.stock).toBe(60)
  })

  it('deletes a product -> 200 with message', async () => {
    const toDelete = await db.Product.create({
      name: 'Keyboard', price: 45, stock: 20, categoryId: category.id, color: 'White', size: 'L'
    })
    const res = await request(app)
      .delete(`/api/v1/products/${toDelete.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.message).toMatch(/deleted/i)
  })
})