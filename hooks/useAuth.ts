"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
    async function checkAuth() {
      try {
        // 1. Try Supabase Auth first
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          // If we have a session, use it.
          // Role usually stored in localStorage or needs to be fetched.
          // For now, we mix session with stored metadata.
          const stored = getStoredUser()
          const sbRole = session.user.user_metadata?.role || session.user.app_metadata?.role
          setUser({
            id: stored?.id || session.user.id,
            role: (stored?.role as AuthUser['role']) || (sbRole as AuthUser['role']) || null,
            name: stored?.name || session.user.user_metadata?.name || session.user.email,
            email: session.user.email
          })
          return
        }

        // 2. Fallback to Legacy Cookie/Token
        const token = getCookie('pos.accessToken')
        const payload = token ? parseJwt(token) : null
        const stored = getStoredUser()
        const id = (payload && (payload.sub || null)) ? String(payload.sub) : (stored?.id ?? null)
        
        // Handle Supabase Token (where role is in metadata) or Legacy Token
        let tokenRole = payload?.role
        if (tokenRole === 'authenticated' && (payload.user_metadata || payload.app_metadata)) {
            tokenRole = payload.user_metadata?.role || payload.app_metadata?.role
        }

        const role = (tokenRole as AuthUser['role']) || (stored?.role as AuthUser['role']) || null
        const name = stored?.name || payload?.user_metadata?.name || payload?.name
        const email = stored?.email || payload?.email
        
        if (role) {
          setUser({ id, role, name, email })
        } else {
          setUser(null)
        }
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    // Listen for Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
         const stored = getStoredUser()
         setUser({
            id: stored?.id || session.user.id,
            role: (stored?.role as AuthUser['role']) || null,
            name: stored?.name || session.user.email,
            email: session.user.email
          })
          setLoading(false)
      } else {
         // If Supabase logs out, we might still be logged in via legacy cookie?
         // Ideally we sync states. For now, re-run checkAuth logic or clear user.
         // If purely Supabase, we would setUser(null).
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
