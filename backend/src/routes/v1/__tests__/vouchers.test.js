const request = require('supertest')
const jwt = require('jsonwebtoken')
const { buildApp } = require('../../../server')
const db = require('../../../../../models')

const token = jwt.sign({ sub: 'test-user' }, 'dev-secret', { audience: 'pos-app', issuer: 'pos-backend' })

describe('Vouchers API', () => {
  const app = buildApp()

  beforeAll(async () => {
    await db.sequelize.sync({ force: true })
  })

  it('returns 401 without token', async () => {
    await request(app).get('/api/v1/vouchers').expect(401)
  })

  it('lists vouchers 200 with token', async () => {
    await request(app).get('/api/v1/vouchers').set('Authorization', `Bearer ${token}`).expect(200)
  })

  it('get unknown id returns 404', async () => {
    await request(app).get('/api/v1/vouchers/not-found').set('Authorization', `Bearer ${token}`).expect(404)
  })

  it('validate create voucher payload (missing requireds) -> 400', async () => {
    await request(app)
      .post('/api/v1/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  it('validate update voucher payload (missing requireds) -> 400', async () => {
    await request(app)
      .put('/api/v1/vouchers/any-id')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  it('delete without token returns 401', async () => {
    await request(app).delete('/api/v1/vouchers/any-id').expect(401)
  })

  it('creates a voucher -> 201 and returns entity', async () => {
    const payload = {
      code: 'WELCOME10',
      name: 'Welcome Discount',
      type: 'percentage',
      value: '10.5', // numeric string should be accepted
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString()
    }
    const res = await request(app)
      .post('/api/v1/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201)
    expect(res.body.id).toBeTruthy()
    expect(res.body.type).toBe('percentage')
  })

  it('rejects non-numeric value -> 400 from validator', async () => {
    const payload = {
      code: 'BADNUM', name: 'Bad Number', type: 'fixed', value: 'abc',
      startDate: new Date().toISOString(), endDate: new Date(Date.now() + 86400000).toISOString()
    }
    await request(app)
      .post('/api/v1/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(400)
  })

  it('rejects invalid enum type at validator -> 400', async () => {
    const payload = {
      code: 'BADTYPE', name: 'Bad Type', type: 'unknown', value: 5,
      startDate: new Date().toISOString(), endDate: new Date(Date.now() + 86400000).toISOString()
    }
    await request(app)
      .post('/api/v1/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(400)
  })

  it('rejects invalid date string at model level -> 500', async () => {
    const payload = {
      code: 'BADDATES', name: 'Bad Dates', type: 'fixed', value: 5,
      startDate: 'not-a-date', endDate: 'still-not-a-date'
    }
    await request(app)
      .post('/api/v1/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(400)
  })

  it('updates a voucher -> 200 and persists changes', async () => {
    const created = await db.Voucher.create({
      code: 'UPD1', name: 'Upd', type: 'fixed', value: 5,
      startDate: new Date(), endDate: new Date(Date.now() + 86400000)
    })
    const res = await request(app)
      .put(`/api/v1/vouchers/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Voucher', type: 'fixed', value: 7.5,
        startDate: new Date().toISOString(), endDate: new Date(Date.now() + 172800000).toISOString(), isActive: true
      })
      .expect(200)
    expect(res.body.value).toBe(7.5)
    expect(res.body.name).toBe('Updated Voucher')
  })

  it('deletes a voucher -> 200 with message', async () => {
    const toDelete = await db.Voucher.create({
      code: 'DEL1', name: 'Del', type: 'percentage', value: 10,
      startDate: new Date(), endDate: new Date(Date.now() + 86400000)
    })
    const res = await request(app)
      .delete(`/api/v1/vouchers/${toDelete.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.message).toMatch(/deleted/i)
  })
})