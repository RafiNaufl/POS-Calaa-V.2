const { supabase } = require('../lib/supabase')
const db = require('../models')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const JWT_AUDIENCE = process.env.JWT_AUD || 'pos-app'
const JWT_ISSUER = process.env.JWT_ISS || 'pos-backend'

async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing token' })
  }

  try {
    let user = null
    let isSupabase = false

    // 1. Try Supabase Verification
    const { data, error } = await supabase.auth.getUser(token)
    
    if (!error && data?.user) {
      user = data.user
      isSupabase = true
    } else {
      // 2. Fallback: Local JWT Verification
    try {
      const payload = jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE })
      // Construct a pseudo-user object from local JWT
      user = {
        email: payload.email, // Ensure your local JWT has email, otherwise fetch from DB using sub
        id: payload.sub
      }
      // If local JWT doesn't have email, we might need to fetch it.
      // Legacy payload: { sub: String(user.id), id: Number(user.id), role: user.role, email: user.email, name: user.name }
      // So email is there.
    } catch (jwtErr) {
      console.log('[Auth] JWT Verification failed:', jwtErr.message)
      return res.status(401).json({ error: 'Unauthorized: invalid token' })
    }
  }
    
    // 3. Map to local user
    const email = user.email
    if (!email) {
       // Should not happen if logic above is correct
       console.log('[Auth] No email in token payload')
       return res.status(401).json({ error: 'Unauthorized: no email in token' })
    }

    const localUser = await db.User.findOne({ 
      where: { email },
      attributes: ['id', 'role', 'name', 'email'] 
    })

    if (!localUser) {
      console.log('[Auth] User not found for email:', email)
      return res.status(401).json({ error: 'Unauthorized: user not found in system' })
    }

    // 4. Set req.user
    req.user = {
      id: localUser.id,
      role: localUser.role,
      email: localUser.email,
      name: localUser.name,
      supabaseId: isSupabase ? user.id : null,
      sub: localUser.id
    }

    next()
  } catch (err) {
    console.error('[Auth] Middleware error:', err)
    return res.status(500).json({ error: 'Internal Server Error during auth' })
  }
}

module.exports = { authMiddleware }
