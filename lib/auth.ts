import { NextAuthOptions } from 'next-auth'
import jwt from 'jsonwebtoken'
import CredentialsProvider from 'next-auth/providers/credentials'

// ---- Custom Auth Helpers (Express-based) ----
const TOKEN_KEY = 'pos.accessToken'

function normalizeBackendBase(raw?: string) {
  let base = (raw || '').trim()
  if (!base) return 'http://localhost:4000'
  if (!/^https?:\/\//i.test(base)) {
    base = base.replace(/^\/+/, '')
    base = `https://${base}`
  }
  base = base.replace(/\/+$/, '')
  return base
}

export function setAccessToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (!token) {
    try { window.localStorage.removeItem(TOKEN_KEY) } catch (_) {}
    return
  }
  try { window.localStorage.setItem(TOKEN_KEY, token) } catch (_) {}
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem(TOKEN_KEY) } catch (_) { return null }
}

export async function login(email: string, password: string) {
  const backendBase = normalizeBackendBase(process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:4000')
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
  return data
}

export async function logout() {
  const backendBase = normalizeBackendBase(process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:4000')
  try {
    await fetch(`${backendBase}/api/v1/auth/logout`, { method: 'POST' })
  } catch (_) {}
  setAccessToken(null)
  return { success: true }
}

// Define the database user type
interface DatabaseUser {
  id: number;
  email: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER';
  createdAt: Date;
  updatedAt: Date;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Delegate credential verification to backend Express API
          const backendBase = normalizeBackendBase(process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:4000')
          const res = await fetch(`${backendBase}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: credentials.email, password: credentials.password })
          })

          if (!res.ok) {
            return null
          }

          const data = await res.json()
          const user = data?.user
          if (!user) return null

          // Return user details and pass backend-issued accessToken through
          return {
            id: String(user.id),
            email: user.email,
            name: user.name,
            role: user.role as 'ADMIN' | 'MANAGER' | 'CASHIER',
            accessToken: data.accessToken
          } as any
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        // Preserve backend-issued accessToken if available
        if ((user as any).accessToken) {
          ;(token as any).accessToken = (user as any).accessToken
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token && token.sub) {
        session.user.id = token.sub as string
        session.user.role = token.role as 'ADMIN' | 'CASHIER' | 'MANAGER'
        // Prefer backend-issued accessToken; fallback to signing one locally
        const existing = (token as any).accessToken
        if (existing) {
          ;(session as any).accessToken = existing
        } else {
          try {
            const secret = process.env.JWT_SECRET || 'dev-secret'
            const aud = process.env.JWT_AUD || 'pos-app'
            const iss = process.env.JWT_ISS || 'pos-backend'
            const signed = jwt.sign(
              { sub: token.sub, role: token.role },
              secret,
              { issuer: iss, audience: aud, expiresIn: '1h' }
            )
            ;(session as any).accessToken = signed
          } catch (err) {
            console.error('Failed to sign backend access token:', err)
          }
        }
      } else {
        // Handle case where token or token.sub is missing
        console.error('Missing token or token.sub in session callback')
      }
      return session
    }
  },
  pages: {
    signIn: '/login'
  },
  secret: process.env.NEXTAUTH_SECRET
}

export default authOptions
