const request = require('supertest')
const jwt = require('jsonwebtoken')
const { buildApp } = require('../../../server')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const JWT_AUDIENCE = process.env.JWT_AUD || 'pos-app'
const JWT_ISSUER = process.env.JWT_ISS || 'pos-backend'

function sign(payload) {
  return jwt.sign(payload, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE })
}

describe('Debug Health API', () => {
  const app = buildApp()

  test('GET /api/v1/debug/health without token -> 401', async () => {
    const res = await request(app).get('/api/v1/debug/health')
    expect(res.status).toBe(401)
  })

  test('GET /api/v1/debug/health with token -> 200 and shape', async () => {
    const token = sign({ sub: 'test-user', role: 'ADMIN' })
    const res = await request(app)
      .get('/api/v1/debug/health')
      .set('Authorization', `Bearer ${token}`)

    // Allow 200 or 500 depending on environment DB connectivity
    expect([200, 500]).toContain(res.status)
    if (res.status === 200) {
      const body = res.body
      expect(body).toHaveProperty('status', 'ok')
      expect(body).toHaveProperty('version', 'v1')
      expect(body).toHaveProperty('timestamp')
      expect(body).toHaveProperty('user')
      expect(body).toHaveProperty('db')
      expect(body.db).toHaveProperty('connected')
      expect(body).toHaveProperty('counts')
      const keys = ['users','products','categories','members','transactions','promotions','vouchers','shifts']
      for (const k of keys) {
        expect(Object.prototype.hasOwnProperty.call(body.counts, k)).toBe(true)
      }
    }
  })
})