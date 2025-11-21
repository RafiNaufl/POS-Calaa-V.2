import { apiFetch } from './api'

export async function apiGetJson<T = any>(url: string): Promise<T> {
  const res = await apiFetch(url, { method: 'GET' })
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`)
  return res.json()
}

export async function apiPostJson<T = any>(url: string, body: any): Promise<T> {
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`)
  return res.json()
}

export async function apiPutJson<T = any>(url: string, body: any): Promise<T> {
  const res = await apiFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`PUT ${url} failed: ${res.status}`)
  return res.json()
}

export async function apiDelete(url: string): Promise<void> {
  const res = await apiFetch(url, { method: 'DELETE' })
  if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status}`)
}