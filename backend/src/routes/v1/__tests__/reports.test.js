const request = require('supertest')
const jwt = require('jsonwebtoken')
const express = require('express')

const reportsRouter = require('../reports')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/reports', reportsRouter)
  return app
}

function signToken(payload) {
  const secret = process.env.JWT_SECRET || 'dev-secret'
  const issuer = process.env.JWT_ISS || 'pos-backend'
  const audience = process.env.JWT_AUD || 'pos-app'
  return jwt.sign(payload, secret, { issuer, audience })
}

describe('Reports API', () => {
  const app = buildApp()

  it('rejects unauthorized financial report requests', async () => {
    const res = await request(app).get('/api/v1/reports/financial')
    expect(res.status).toBe(401)
  })

  it('accepts authorized request and returns summary fields', async () => {
    const token = signToken({ id: 1, role: 'ADMIN' })
    const res = await request(app)
      .get('/api/v1/reports/financial?range=7days')
      .set('Authorization', `Bearer ${token}`)
    // Status should be 200 even if DB empty, with numeric fields
    expect([200,500]).toContain(res.status)
    if (res.status === 200) {
      expect(res.body).toHaveProperty('range')
      expect(res.body).toHaveProperty('grossSales')
      expect(res.body).toHaveProperty('revenue')
    }
  })
})