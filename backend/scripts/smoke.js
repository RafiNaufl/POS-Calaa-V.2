'use strict'

const urlBase = process.env.BACKEND_URL || process.env.RENDER_BACKEND_URL || 'http://localhost:4000'

async function check(path) {
  const url = `${urlBase}${path}`
  const res = await fetch(url, { method: 'GET' })
  const ok = res.ok
  let body
  try { body = await res.json() } catch { body = null }
  return { path, status: res.status, ok, body }
}

async function main() {
  const results = []
  results.push(await check('/health'))
  results.push(await check('/api/v1/status'))

  let failed = false
  for (const r of results) {
    if (!r.ok) failed = true
  }

  if (failed) {
    console.error('[smoke] failed', results)
    process.exit(1)
  } else {
    console.log('[smoke] ok', results)
    process.exit(0)
  }
}

main().catch((err) => { console.error('[smoke] error', err); process.exit(1) })
