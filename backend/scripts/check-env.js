#!/usr/bin/env node
'use strict'

// Backend env checker for Express server
// Ensures critical environment variables are present before starting the server.

const fs = require('fs')
const path = require('path')

// Load backend-specific env first if available, then fall back to root .env
try {
  const backendEnv = path.join(process.cwd(), 'backend/.env')
  if (fs.existsSync(backendEnv)) {
    require('dotenv').config({ path: backendEnv, override: true })
  } else {
    require('dotenv').config()
  }
  const localEnv = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(localEnv)) {
    require('dotenv').config({ path: localEnv, override: true })
  }
} catch {}

const isProd = process.env.NODE_ENV === 'production'

function requireVar(name, context = 'runtime') {
  const val = process.env[name]
  if (!val || String(val).trim() === '') {
    console.error(`[env:backend] Missing required ${context} variable: ${name}`)
    return false
  }
  return true
}

function warnVar(name, message) {
  const val = process.env[name]
  if (!val || String(val).trim() === '') {
    console.warn(`[env:backend] Warning: ${name} ${message}`)
  }
}

let ok = true

// Always required
ok = requireVar('DATABASE_URL', 'runtime') && ok
ok = requireVar('JWT_SECRET', 'runtime') && ok

// Required in production for proper CORS
if (isProd) {
  ok = requireVar('CORS_ORIGIN', 'production') && ok
}

// Midtrans requirements when running in production mode for payments
const midtransProd = String(process.env.MIDTRANS_IS_PRODUCTION || '').toLowerCase() === 'true'
if (midtransProd) {
  ok = requireVar('MIDTRANS_SERVER_KEY', 'midtrans') && ok
  ok = requireVar('MIDTRANS_MERCHANT_ID', 'midtrans') && ok
}

// WhatsApp session directory
const waDir = process.env.WHATSAPP_SESSION_DIR
if (!waDir || String(waDir).trim() === '') {
  warnVar('WHATSAPP_SESSION_DIR', 'is not set; WhatsApp features may be disabled or ephemeral')
} else {
  try {
    if (!fs.existsSync(waDir)) {
      console.warn(`[env:backend] Warning: WHATSAPP_SESSION_DIR does not exist: ${waDir}`)
    }
  } catch (err) {
    console.warn(`[env:backend] Warning: Failed to check WHATSAPP_SESSION_DIR: ${err.message}`)
  }
}

if (!ok) {
  console.error('[env:backend] One or more required environment variables are missing. See docs/env-checklist.md')
  process.exit(1)
} else {
  console.log('[env:backend] Environment check passed')
}

