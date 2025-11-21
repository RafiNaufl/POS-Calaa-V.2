// Client-safe auth helpers (no server-only imports)
import { signIn, signOut } from 'next-auth/react'

const TOKEN_KEY = 'pos.accessToken'
const COOKIE_KEY = 'pos.accessToken'

export function setAccessToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (!token) {
    try { window.localStorage.removeItem(TOKEN_KEY) } catch (_) {}
    try { document.cookie = `${COOKIE_KEY}=; Path=/; Max-Age=0` } catch (_) {}
    return
  }
  try { window.localStorage.setItem(TOKEN_KEY, token) } catch (_) {}
  try {
    // Set a non-HttpOnly cookie for middleware visibility in dev
    const maxAge = 12 * 60 * 60 // 12 hours
    document.cookie = `${COOKIE_KEY}=${token}; Path=/; Max-Age=${maxAge}`
  } catch (_) {}
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem(TOKEN_KEY) } catch (_) { return null }
}

export async function login(email: string, password: string) {
  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
  const res = await fetch(`${backendBase}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) {
    let msg = 'Login gagal'
    try { const data = await res.json(); msg = data.error || msg } catch (_) {}
    throw new Error(msg)
  }
  const data = await res.json()
  setAccessToken(data.accessToken || null)

  // Sync NextAuth session for server-side APIs/middleware (getServerSession);
  // client pages use useAuth for gating and user state
  try {
    await signIn('credentials', { email, password, redirect: false })
  } catch (_) {}
  return data
}

export async function logout() {
  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
  try { await fetch(`${backendBase}/api/v1/auth/logout`, { method: 'POST' }) } catch (_) {}
  setAccessToken(null)
  try { await signOut({ redirect: false }) } catch (_) {}
  return { success: true }
}