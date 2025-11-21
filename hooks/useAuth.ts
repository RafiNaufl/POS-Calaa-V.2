"use client"

import { useEffect, useState } from 'react'

interface AuthUser {
  id: string | null
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | null
  name?: string
  email?: string
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()!.split(';').shift() || null
  return null
}

function parseJwt(token: string): any | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload
  } catch (_) {
    return null
  }
}

function getStoredUser(): Partial<AuthUser> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('pos.user')
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const token = getCookie('pos.accessToken')
      const payload = token ? parseJwt(token) : null
      const stored = getStoredUser()
      const id = (payload && (payload.sub || null)) ? String(payload.sub) : (stored?.id ?? null)
      const role = (payload?.role as AuthUser['role']) || (stored?.role as AuthUser['role']) || null
      const name = stored?.name
      const email = stored?.email
      if (role) {
        setUser({ id, role, name, email })
      } else {
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return { user, loading }
}