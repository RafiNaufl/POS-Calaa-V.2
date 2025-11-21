#!/usr/bin/env node
'use strict'

// Frontend env checker for Next.js
// Fails fast if required environment variables are missing before dev/build.

const fs = require('fs')
const path = require('path')

// Load env from .env and prefer .env.local for local overrides
try {
  require('dotenv').config()
  const localEnv = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(localEnv)) {
    require('dotenv').config({ path: localEnv, override: true })
  }
} catch {}

const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'

function requireVar(name, context = 'runtime') {
  const val = process.env[name]
  if (!val || String(val).trim() === '') {
    console.error(`[env:frontend] Missing required ${context} variable: ${name}`)
    return false
  }
  return true
}

function warnVar(name, message) {
  const val = process.env[name]
  if (!val || String(val).trim() === '') {
    console.warn(`[env:frontend] Warning: ${name} ${message}`)
  }
}

let ok = true

// Always required
ok = requireVar('NEXT_PUBLIC_BACKEND_URL', 'runtime') && ok

// Required in production for NextAuth server-side crypto and callbacks
if (isProd) {
  ok = requireVar('NEXTAUTH_URL', 'production') && ok
  ok = requireVar('NEXTAUTH_SECRET', 'production') && ok
}

// Optional: Midtrans Snap Client Key, only needed if Midtrans payments are enabled on frontend
warnVar('NEXT_PUBLIC_MIDTRANS_CLIENT_KEY', 'is not set; required if using Midtrans Snap on frontend')

if (!ok) {
  console.error('[env:frontend] One or more required environment variables are missing. See docs/env-checklist.md')
  process.exit(1)
} else {
  console.log('[env:frontend] Environment check passed')
}

