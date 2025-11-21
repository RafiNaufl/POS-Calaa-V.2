const request = require('supertest')
const jwt = require('jsonwebtoken')
const { buildApp } = require('../../../server')
const db = require('../../../../../models')

const token = jwt.sign({ sub: 'test-user' }, 'dev-secret', { audience: 'pos-app', issuer: 'pos-backend' })

describe('Members API', () => {
  const app = buildApp()

  beforeAll(async () => {
    await db.sequelize.sync({ force: true })
  })

  it('returns 401 without token', async () => {
    await request(app).get('/api/v1/members').expect(401)
  })

  it('lists members 200 with token', async () => {
    await request(app).get('/api/v1/members').set('Authorization', `Bearer ${token}`).expect(200)
  })

  it('get unknown id returns 404', async () => {
    await request(app).get('/api/v1/members/not-found').set('Authorization', `Bearer ${token}`).expect(404)
  })

  it('validate create member payload (missing name) -> 400', async () => {
    await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  it('validate update member payload (missing name) -> 400', async () => {
    await request(app)
      .put('/api/v1/members/any-id')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  it('delete without token returns 401', async () => {
    await request(app).delete('/api/v1/members/any-id').expect(401)
  })

  it('creates a member -> 201 and returns entity', async () => {
    const res = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'John Doe', phone: '123', email: 'john@example.com' })
      .expect(201)
    expect(res.body.id).toBeTruthy()
    expect(res.body.name).toBe('John Doe')
  })

  it('updates a member -> 200 and persists changes', async () => {
    const created = await db.Member.create({ name: 'Jane' })
    const res = await request(app)
      .put(`/api/v1/members/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jane Smith', phone: '555' })
      .expect(200)
    expect(res.body.name).toBe('Jane Smith')
  })

  it('deletes a member -> 200 with message', async () => {
    const toDelete = await db.Member.create({ name: 'Temp' })
    const res = await request(app)
      .delete(`/api/v1/members/${toDelete.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.message).toMatch(/deleted/i)
  })
})