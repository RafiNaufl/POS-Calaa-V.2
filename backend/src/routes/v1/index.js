const { Router } = require('express')
const jwt = require('jsonwebtoken')
const { authMiddleware } = require('../../middleware/auth')
const { buildValidator } = require('../../middleware/validate')
const db = require('../../../../models')
const { supabase, supabaseAdmin } = require('../../lib/supabase')

const router = Router()

// Public status endpoint
router.get('/status', (_req, res) => {
  res.json({ status: 'ok', version: 'v1', timestamp: new Date().toISOString() })
})

// Session endpoint: Support both Local and Supabase tokens
router.get('/auth/session', async (req, res) => {
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
  const JWT_AUDIENCE = process.env.JWT_AUD || 'pos-app'
  const JWT_ISSUER = process.env.JWT_ISS || 'pos-backend'

  const authHeader = req.headers['authorization'] || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (bearer) {
    // 1. Try Supabase
    const { data: sbData } = await supabase.auth.getUser(bearer)
    if (sbData?.user?.email) {
       // Fetch local user for role
       const user = await db.User.findOne({ where: { email: sbData.user.email }, attributes: ['id', 'role', 'name', 'email'] })
       if (user) {
         // Supabase token expires_at is not easily available from getUser, 
         // but client usually tracks it. We just say "valid".
         return res.json({ 
           user: { id: String(user.id), role: user.role }, 
           expires: null, 
           accessToken: bearer, 
           loggedIn: true, 
           provider: 'supabase' 
         })
       }
    }

    // 2. Try Local JWT
    try {
      const payload = jwt.verify(bearer, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE })
      const exp = payload && typeof payload.exp === 'number' ? new Date(payload.exp * 1000).toISOString() : null
      const user = { id: String(payload.sub || ''), role: payload.role || undefined }
      return res.json({ user, expires: exp, accessToken: bearer, loggedIn: true, provider: 'express-jwt' })
    } catch (_) {
      // Invalid token
    }
  }

  return res.json({ user: null, expires: null, accessToken: null, loggedIn: false })
})

// Login endpoint: verify credentials and issue backend JWT or Supabase Token
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' })
    }

    // 1. Try Supabase Login (if user already migrated)
    const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({ email, password })
    
    if (!sbError && sbData?.session) {
      // Success! User is in Supabase.
      const { DataTypes } = require('sequelize')
      const User = require('../../../../models/user')(db.sequelize, DataTypes)
      const user = await User.findOne({ where: { email } })
      
      if (!user) {
          return res.status(401).json({ error: 'User tidak ditemukan di sistem lokal' })
      }
      
      return res.json({
          user: { id: String(user.id), role: user.role, email: user.email, name: user.name },
          accessToken: sbData.session.access_token,
          expires: new Date(sbData.session.expires_at * 1000).toISOString(),
          loggedIn: true,
          provider: 'supabase'
      })
    }

    // 2. Fallback: Local Login + Auto-Migrate
    const { DataTypes } = require('sequelize')
    const User = require('../../../../models/user')(db.sequelize, DataTypes)
    const user = await User.findOne({ where: { email } })
    if (!user) {
      return res.status(401).json({ error: 'Email atau password salah' })
    }

    // Validate password (local)
    let valid = false
    try {
      const bcrypt = require('bcryptjs')
      const looksHashed = typeof user.password === 'string' && user.password.startsWith('$2')
      if (looksHashed) {
        valid = await bcrypt.compare(password, user.password)
      } else {
        valid = String(user.password) === String(password)
      }
    } catch (_err) {
       valid = String(user.password) === String(password)
    }

    if (!valid) {
      return res.status(401).json({ error: 'Email atau password salah' })
    }

    // Local login success! Now Migrate to Supabase if Admin key available
    let accessToken = null
    let expiry = null
    let provider = 'express-jwt'

    if (supabaseAdmin) {
       // Check if user exists in Supabase but password failed (maybe changed in Supabase?)
       // Actually signInWithPassword failed above, so either user missing or password wrong.
       // We assume user missing if local works.
       // Try create user
       const { data: newData, error: newError } = await supabaseAdmin.auth.admin.createUser({
         email: email,
         password: password,
         email_confirm: true,
         user_metadata: { name: user.name, role: user.role }
       })

       if (!newError && newData?.user) {
         // Now sign in to get a session
         const { data: sessData } = await supabase.auth.signInWithPassword({ email, password })
         if (sessData?.session) {
            accessToken = sessData.session.access_token
            expiry = new Date(sessData.session.expires_at * 1000).toISOString()
            provider = 'supabase'
            console.log(`[Auth] User ${email} auto-migrated to Supabase`)
         }
       } else {
         // If error is "User already registered", it means password mismatch between local and supabase
         // We can't update supabase password easily without reset.
         // Just fall back to local token.
         console.warn('[Auth] Auto-migration skipped:', newError?.message)
       }
    }

    // If migration failed or no admin key, fall back to issuing local JWT
    if (!accessToken) {
        const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
        const JWT_AUDIENCE = process.env.JWT_AUD || 'pos-app'
        const JWT_ISSUER = process.env.JWT_ISS || 'pos-backend'
        const payload = { sub: String(user.id), id: Number(user.id), role: user.role, email: user.email, name: user.name }
        accessToken = jwt.sign(payload, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: '12h' })
        expiry = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    }

    return res.json({
      user: { id: String(user.id), role: user.role, email: user.email, name: user.name },
      accessToken,
      expires: expiry,
      loggedIn: true,
      provider
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
    
    // Existing bootstrap logic (kept simple, assumes local DB)
    const { DataTypes } = require('sequelize')
    const User = require('../../../../models/user')(db.sequelize, DataTypes)
    
    // Check if any admin exists
    const existingAdmin = await User.findOne({ where: { role: 'ADMIN' } })
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin already exists' })
    }
    
    const bcrypt = require('bcryptjs')
    const hashedPassword = await bcrypt.hash('admin123', 10)
    
    const admin = await User.create({
      name: 'Admin Dev',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'ADMIN'
    })
    
    return res.json({ message: 'Admin user created', email: admin.email, password: 'admin123' })
  } catch (err) {
    console.error('[Bootstrap] Error:', err)
    return res.status(500).json({ error: 'Failed to bootstrap' })
  }
})

module.exports = router
