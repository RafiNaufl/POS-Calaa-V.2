'use strict'

// Grants USAGE, SELECT on sequence "PointHistories_id_seq" and INSERT on table "PointHistories"
// Uses superuser connection from .env.migration (same pattern as other grant scripts)

const path = require('path')
const { Client } = require('pg')

// Load superuser connection string explicitly and override other envs
require('dotenv').config({ path: path.join(process.cwd(), '.env.migration'), override: true })

let url = process.env.DATABASE_URL
const ROLE = process.env.APP_DB_ROLE || 'posuser'

async function main() {
  if (!url) {
    console.error('[grant-pointhistory-privs] DATABASE_URL not set in .env.migration')
    process.exit(1)
  }

  // Normalize protocol if needed and mask password in log
  if (url.startsWith('postgresql://')) {
    url = url.replace(/^postgresql:\/\//, 'postgres://')
  }
  const masked = (() => {
    try {
      const u = new URL(url)
      const pw = u.password ? '***' : ''
      const auth = u.username + (pw ? ':' + pw : '')
      return `${u.protocol}//${auth}@${u.hostname}:${u.port}${u.pathname}`
    } catch { return '(hidden)' }
  })()
  console.log('[grant-pointhistory-privs] Connecting with .env.migration DATABASE_URL:', masked)
  console.log('[grant-pointhistory-privs] Target role:', ROLE)

  const client = new Client({ connectionString: url })

  try {
    await client.connect()
    const who = await client.query('SELECT current_user, current_database()')
    console.log('[grant-pointhistory-privs] Connected as:', who.rows[0])

    // Ensure sequence exists
    const seqCheck = await client.query(
      `SELECT relname FROM pg_class WHERE relkind = 'S' AND relname = 'PointHistories_id_seq'`
    )
    if (!seqCheck.rows.length) {
      console.warn('[grant-pointhistory-privs] WARNING: Sequence "PointHistories_id_seq" not found. Continuing with table grant.')
    } else {
      console.log('[grant-pointhistory-privs] Granting USAGE on sequence "PointHistories_id_seq" to', ROLE)
      await client.query(`GRANT USAGE ON SEQUENCE "PointHistories_id_seq" TO ${ROLE}`)
      console.log('[grant-pointhistory-privs] Granting SELECT on sequence "PointHistories_id_seq" to', ROLE)
      await client.query(`GRANT SELECT ON SEQUENCE "PointHistories_id_seq" TO ${ROLE}`)
    }

    // Optionally grant on all sequences in public for robustness
    console.log('[grant-pointhistory-privs] Granting USAGE, SELECT on ALL SEQUENCES in schema public to', ROLE)
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROLE}`)

    // Grant INSERT on the table
    console.log('[grant-pointhistory-privs] Granting INSERT on table "PointHistories" to', ROLE)
    await client.query(`GRANT INSERT ON TABLE "PointHistories" TO ${ROLE}`)

    // Basic verification: check privileges using information_schema and has_* functions
    const [privRows] = [
      (await client.query(
        `SELECT 
           has_table_privilege('${ROLE}', 'public.PointHistories', 'INSERT') AS can_insert,
           has_schema_privilege('${ROLE}', 'public', 'USAGE') AS has_schema_usage,
           has_schema_privilege('${ROLE}', 'public', 'CREATE') AS has_schema_create`
      )).rows
    ]
    console.log('[grant-pointhistory-privs] Privilege check (table/schema):', privRows?.[0] || privRows)

    console.log('[grant-pointhistory-privs] Done')
    process.exit(0)
  } catch (err) {
    console.error('[grant-pointhistory-privs] Error:', err.message || err)
    if (err.code) console.error('[grant-pointhistory-privs] SQLSTATE:', err.code)
    process.exit(2)
  } finally {
    try { await client.end() } catch {}
  }
}

main()