/* Express backend entrypoint with API versioning and fallback proxy */
const express = require('express')
const cors = require('cors')
const IS_TEST = process.env.NODE_ENV === 'test'
const morgan = IS_TEST ? null : require('morgan')
// Prefer Node's native global fetch (Node >=18). Avoid ESM/CommonJS interop pitfalls.
const nativeFetch = typeof globalThis.fetch === 'function' ? globalThis.fetch : null
const fetch = IS_TEST ? null : nativeFetch

const { authMiddleware } = require('./middleware/auth')
const { errorHandler, notFoundHandler } = require('./middleware/error')
const { requestLogger } = require('./middleware/logger')

const v1Routes = require('./routes/v1')

function buildApp () {
  const app = express()

  // Config
  const API_PREFIX = '/api'
  const API_VERSION = 'v1'
  const NEXT_FALLBACK_BASE = process.env.BACKEND_NEXT_FALLBACK_URL || 'http://127.0.0.1:3001'
  const IS_DEV = process.env.NODE_ENV === 'development'

  // Global middleware (CORS with credentials for dev cross-origin requests)
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3001')
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
  const allowedSet = new Set(allowedOrigins)
  const corsOptions = {
    origin: function (origin, callback) {
      // Allow non-browser clients (no origin) and whitelisted origins (normalized)
      if (!origin) return callback(null, true)
      const normalized = String(origin).trim().replace(/\/$/, '')
      const isLocal = normalized.startsWith('http://localhost:') || normalized.startsWith('http://127.0.0.1:') || normalized.startsWith('http://0.0.0.0:')
      if (isLocal || allowedSet.has(normalized)) return callback(null, true)
      const err = new Error('Not allowed by CORS')
      err.status = 403
      err.code = 'CORS_NOT_ALLOWED'
      return callback(err)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
  }
  app.use(cors(corsOptions))
  app.options('*', cors(corsOptions))
  app.use(express.json({ limit: '2mb' }))
  app.use(requestLogger)
  if (morgan) app.use(morgan('tiny'))

  // Disable ETag and caching in development to avoid 304 Not Modified for API responses
  if (IS_DEV) {
    app.set('etag', false)
    app.use((_req, res, next) => {
      res.setHeader('Cache-Control', 'no-store')
      next()
    })
  }

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'express-backend', timestamp: new Date().toISOString() })
  })

  // Versioned API router
  app.use(`${API_PREFIX}/${API_VERSION}`, v1Routes)

  // Explicitly mount WhatsApp routes to ensure availability even if sub-router mounting changes
  try {
    const whatsappRoutes = require('./routes/v1/whatsapp')
    app.use(`${API_PREFIX}/${API_VERSION}/whatsapp`, whatsappRoutes)
  } catch (err) {
    console.error('[Express] Failed to mount WhatsApp routes:', err)
  }

  // Legacy alias and fallback proxy removed: all clients must call /api/v1/* directly

  // 404 and error handling
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

// Only start the server when not in test mode
  if (!IS_TEST) {
    const PORT = process.env.PORT || process.env.BACKEND_PORT || 4000
    const API_PREFIX = '/api'
    const API_VERSION = 'v1'
    const NEXT_FALLBACK_BASE = process.env.BACKEND_NEXT_FALLBACK_URL || 'http://127.0.0.1:3001'
    const app = buildApp()
    app.listen(PORT, () => {
      console.log(`[Express] Backend listening on port ${PORT} at ${API_PREFIX}/${API_VERSION}`)
      console.log(`[Express] Fallback proxy: DISABLED`)
    })
  }

module.exports = { buildApp }
