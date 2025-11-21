"use client"

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

type Json = Record<string, any>

export default function AuthDiagnosticsPage() {
  const { user, loading: authLoading } = useAuth()
  const [authSessionResp, setAuthSessionResp] = useState<Json | null>(null)
  const [backendStatus, setBackendStatus] = useState<Json | null>(null)
  const [healthResp, setHealthResp] = useState<Json | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchJson(url: string): Promise<Json | null> {
    try {
      const res = await fetch(url)
      const json = await res.json()
      return json
    } catch (err: any) {
      setError(`Failed to fetch ${url}: ${String(err?.message || err)}`)
      return null
    }
  }

  useEffect(() => {
    // Probe common endpoints for quick diagnostics
    // Use Express v1 session endpoint, routed with apiFetch to include Authorization
    apiFetch('/api/v1/auth/session')
      .then((res) => res.json())
      .then(setAuthSessionResp)
      .catch((err) => setError(`Failed to fetch /api/v1/auth/session: ${String(err?.message || err)}`))
    fetchJson('/api/v1/status').then(setBackendStatus)
    // Use apiFetch to hit native Express v1 health endpoint
    apiFetch('/api/v1/debug/health')
      .then((res) => res.json())
      .then(setHealthResp)
      .catch((err) => setError(`Failed to fetch /api/v1/debug/health: ${String(err?.message || err)}`))
  }, [])

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Auth Diagnostics</h1>
      {error && (
        <div className="rounded-md bg-red-50 text-red-700 p-3">{error}</div>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Client Auth (useAuth)</h2>
        <div className="text-sm text-gray-700">Status: {authLoading ? 'loading' : user ? 'authenticated' : 'unauthenticated'}</div>
        <pre className="bg-gray-100 text-xs p-3 rounded-md overflow-x-auto">
          {JSON.stringify(user, null, 2)}
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Express /api/v1/auth/session</h2>
        <pre className="bg-gray-100 text-xs p-3 rounded-md overflow-x-auto">
          {JSON.stringify(authSessionResp, null, 2)}
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Backend /api/v1/status</h2>
        <pre className="bg-gray-100 text-xs p-3 rounded-md overflow-x-auto">
          {JSON.stringify(backendStatus, null, 2)}
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Debug Health /api/debug/health</h2>
        <pre className="bg-gray-100 text-xs p-3 rounded-md overflow-x-auto">
          {JSON.stringify(healthResp, null, 2)}
        </pre>
      </section>
    </div>
  )
}