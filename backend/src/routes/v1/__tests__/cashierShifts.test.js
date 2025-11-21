const request = require('supertest')
const jwt = require('jsonwebtoken')
const { buildApp } = require('../../../server')

const token = jwt.sign({ sub: 'test-user' }, 'dev-secret', { audience: 'pos-app', issuer: 'pos-backend' })

describe('Cashier Shifts API', () => {
  const app = buildApp()

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