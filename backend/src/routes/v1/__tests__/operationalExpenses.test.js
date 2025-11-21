const request = require('supertest')
const jwt = require('jsonwebtoken')
const express = require('express')

const { authMiddleware } = require('../../../middleware/auth')
const operationalExpensesRouter = require('../operationalExpenses')

// Build an app instance for testing
function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/operational-expenses', operationalExpensesRouter)
  return app
}

// Create a helper to sign tokens
function signToken(payload) {
  const secret = process.env.JWT_SECRET || 'dev-secret'
  const issuer = process.env.JWT_ISS || 'pos-backend'
  const audience = process.env.JWT_AUD || 'pos-app'
  return jwt.sign(payload, secret, { issuer, audience })
}

describe('Operational Expenses API', () => {
  const app = buildApp()

  it('rejects unauthorized requests', async () => {
    const res = await request(app).get('/api/v1/operational-expenses')
    expect(res.status).toBe(401)
  })

  it('validates create payload', async () => {
    const token = signToken({ id: 1, role: 'ADMIN' })
    const res = await request(app)
      .post('/api/v1/operational-expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Paper', category: 'SUPPLIES' })
    expect(res.status).toBe(400)
  })
})