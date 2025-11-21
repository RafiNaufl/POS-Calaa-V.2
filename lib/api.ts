import { getAccessToken } from './auth-client'

// Prevent flooding the console with repeated session fetch errors during dev
let hasWarnedTokenOnce = false

// Resolve URL for v1/legacy endpoints to the Express backend, handling both
// relative paths and absolute URLs pointing at the Next dev server.
function resolveApiUrl(input: string, backendBase: string): string {
  if (typeof input !== 'string') return input as unknown as string

  const isV1 = input.includes('/api/v1')
  const isLegacy = input.includes('/api/legacy')
  if (!isV1 && !isLegacy) return input

  try {
    // If an absolute URL was passed (e.g., http://localhost:3000/api/v1/...)
    // normalize to path+search and route to backendBase
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const u = new URL(input)
      const pathWithSearch = `${u.pathname}${u.search}`
      return `${backendBase}${pathWithSearch}`
    }
  } catch (_) {
    // Fall through to the relative handling below
  }

  // Relative path case (e.g., /api/v1/products?... or /api/legacy/...)
  return `${backendBase}${input}`
}

export async function apiFetch(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers || {})
  // Prefer local token from custom auth helper
  const localToken = typeof window !== 'undefined' ? getAccessToken() : null
  if (localToken) {
    headers.set('Authorization', `Bearer ${localToken}`)
  } else if (typeof document !== 'undefined') {
    // Fallback: read token from cookie when localStorage is unavailable
    try {
      const cookie = document.cookie || ''
      const parts = cookie.split(';').map((p) => p.trim())
      for (const p of parts) {
        const idx = p.indexOf('=')
        if (idx > 0) {
          const k = p.slice(0, idx)
          const v = p.slice(idx + 1)
          if (k === 'pos.accessToken' && v) {
            headers.set('Authorization', `Bearer ${decodeURIComponent(v)}`)
            break
          }
        }
      }
    } catch (_) {}
    if (!headers.has('Authorization') && !hasWarnedTokenOnce) {
      console.warn('[apiFetch] no access token found (localStorage/cookie); proceeding without Authorization')
      hasWarnedTokenOnce = true
    }
  } else {
    if (!hasWarnedTokenOnce) {
      console.warn('[apiFetch] no access token available; proceeding without Authorization')
      hasWarnedTokenOnce = true
    }
  }
  // Default Content-Type for JSON requests when body is present
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  // Hint browsers to skip caches to avoid 304 for API reads
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-cache')
  }

  // Route v1 API calls to the Express backend base URL
  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
  const url = resolveApiUrl(input, backendBase)

  return fetch(url, { ...init, headers, credentials: init?.credentials || 'include', cache: init?.cache || 'no-store' })
}

export async function apiJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(input, init)
  if (!res.ok) {
    try {
      const err = await res.json()
      throw new Error(err.error || res.statusText)
    } catch (_) {
      throw new Error(res.statusText)
    }
  }
  return res.json()
}

export const apiSWRFetcher = async (url: string) => {
  const res = await apiFetch(url)
  if (!res.ok) throw new Error('Failed to fetch data')
  return res.json()
}