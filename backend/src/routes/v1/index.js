const { Router } = require('express')
const jwt = require('jsonwebtoken')
const { authMiddleware } = require('../../middleware/auth')
const { buildValidator } = require('../../middleware/validate')
const db = require('../../../../models')

const router = Router()

// Public status endpoint
router.get('/status', (_req, res) => {
  res.json({ status: 'ok', version: 'v1', timestamp: new Date().toISOString() })
})

// Session endpoint: JWT-only (no NextAuth cookie fallback)
router.get('/auth/session', (req, res) => {
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
  const JWT_AUDIENCE = process.env.JWT_AUD || 'pos-app'
  const JWT_ISSUER = process.env.JWT_ISS || 'pos-backend'

  const authHeader = req.headers['authorization'] || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (bearer) {
    try {
      const payload = jwt.verify(bearer, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE })
      const exp = payload && typeof payload.exp === 'number' ? new Date(payload.exp * 1000).toISOString() : null
      const user = { id: String(payload.sub || ''), role: payload.role || undefined }
      return res.json({ user, expires: exp, accessToken: bearer, loggedIn: true, provider: 'express-jwt' })
    } catch (_) {
      // Invalid token; return anonymous
    }
  }

  return res.json({ user: null, expires: null, accessToken: null, loggedIn: false })
})

// Login endpoint: verify credentials and issue backend JWT
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' })
    }

    const { DataTypes } = require('sequelize')
    const User = require('../../../../models/user')(db.sequelize, DataTypes)
    const user = await User.findOne({ where: { email } })
    if (!user) {
      return res.status(401).json({ error: 'Email atau password salah' })
    }

    let valid = false
    try {
      const bcrypt = require('bcryptjs')
      // If stored password looks like a bcrypt hash, use bcrypt compare.
      // Otherwise, fall back to plaintext compare for dev/seeded users.
      const looksHashed = typeof user.password === 'string' && user.password.startsWith('$2')
      if (looksHashed) {
        valid = await bcrypt.compare(password, user.password)
      } else {
        valid = String(user.password) === String(password)
      }
    } catch (_err) {
      // Fallback compare (plaintext or unsupported bcrypt)
      valid = String(user.password) === String(password)
    }

    if (!valid) {
      return res.status(401).json({ error: 'Email atau password salah' })
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
    const JWT_AUDIENCE = process.env.JWT_AUD || 'pos-app'
    const JWT_ISSUER = process.env.JWT_ISS || 'pos-backend'

    // Include both `sub` and explicit `id` to satisfy downstream routes
    // that read `req.user.id` (e.g., cashier-shifts actions)
    const payload = { sub: String(user.id), id: Number(user.id), role: user.role, email: user.email, name: user.name }
    const accessToken = jwt.sign(payload, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: '12h' })
    const exp = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()

    return res.json({
      user: { id: String(user.id), role: user.role, email: user.email, name: user.name },
      accessToken,
      expires: exp,
      loggedIn: true,
      provider: 'express-jwt'
    })
  } catch (err) {
    console.error('[Express] /auth/login error:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

// Dev-only bootstrap to create an admin user quickly
router.post('/auth/bootstrap-dev', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Forbidden in production' })
    }
    const { email = 'admin@pos.local', password = 'admin123', name = 'Admin' } = req.body || {}
    const { DataTypes } = require('sequelize')
    const User = require('../../../../models/user')(db.sequelize, DataTypes)
    let user = await User.findOne({ where: { email } })
    let created = false
    if (!user) {
      user = await User.create({ email, password, name, role: 'ADMIN' })
      created = true
    }
    const sanitized = user.get({ plain: true })
    delete sanitized.password
    return res.json({ created, user: sanitized })
  } catch (err) {
    console.error('[Express] /auth/bootstrap-dev error:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

// Logout endpoint: stateless, client should discard token
router.post('/auth/logout', (_req, res) => {
  return res.json({ success: true })
})

// Protected demo endpoint using JWT and validation
router.post(
  '/echo',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      message: { type: 'string', required: true }
    }
  }),
  (req, res) => {
    res.json({ echoed: req.body.message, user: req.user })
  }
)

// Protected debug health endpoint
router.get('/debug/health', authMiddleware, async (req, res) => {
  try {
    // Check DB connectivity
    let connected = false
    let conn = null
    try {
      await db.sequelize.authenticate()
      connected = true
      const cfg = db.sequelize?.config || {}
      conn = {
        dialect: db.sequelize?.getDialect?.(),
        database: cfg.database || null,
        username: cfg.username || null,
        host: cfg.host || null,
        port: cfg.port || null,
      }
    } catch (e) {
      connected = false
    }

    // Lightweight counts (avoid heavy queries)
    const safeCount = async (modelName) => {
      try { return await db[modelName].count() } catch { return null }
    }
    const counts = {
      users: await safeCount('User'),
      products: await safeCount('Product'),
      categories: await safeCount('Category'),
      members: await safeCount('Member'),
      transactions: await safeCount('Transaction'),
      promotions: await safeCount('Promotion'),
      vouchers: await safeCount('Voucher'),
      shifts: await safeCount('CashierShift'),
    }

    res.json({
      status: 'ok',
      version: 'v1',
      timestamp: new Date().toISOString(),
      user: req.user,
      db: { connected, conn },
      counts,
    })
  } catch (err) {
    console.error('[Express] debug/health error:', err)
    res.status(500).json({ status: 'error', error: 'Failed to check health' })
  }
})

// Mount grouped routers
router.use('/users', require('./users'))
router.use('/transactions', require('./transactions'))
router.use('/operational-expenses', require('./operationalExpenses'))
router.use('/reports', require('./reports'))
router.use('/categories', require('./categories'))
router.use('/products', require('./products'))
router.use('/members', require('./members'))
router.use('/vouchers', require('./vouchers'))
router.use('/promotions', require('./promotions'))
router.use('/payments', require('./payments'))
// Action endpoints for payments (confirmations, midtrans integrations)
router.use('/payments', require('./payments.actions'))
// Mount action routes first to ensure specific paths like '/current' take precedence
router.use('/cashier-shifts', require('./cashierShifts.actions'))
router.use('/cashier-shifts', require('./cashierShifts'))
router.use('/whatsapp', require('./whatsapp'))
router.use('/dashboard', require('./dashboard'))


module.exports = router
