// Create (or update) a dedicated Postgres role for local dev based on .env.local
// Uses superuser credentials from .env.migration to perform grants safely.

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

// Load superuser connection from .env.migration and override any existing envs
require('dotenv').config({ path: path.join(process.cwd(), '.env.migration'), override: true })

function parseLocalEnv() {
  const local = { user: null, password: null, database: null }
  const localPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(localPath)) {
    const content = fs.readFileSync(localPath, 'utf8')
    const get = (key) => {
      const re = new RegExp(`^${key}=(?:"|')?(.*?)(?:"|')?$`, 'm')
      const m = content.match(re)
      return m && m[1] ? m[1].trim() : null
    }
    local.user = get('PGUSER') || null
    local.password = get('PGPASSWORD') || null
    local.database = get('PGDATABASE') || null
    const url = get('DATABASE_URL')
    if (url && (!local.user || !local.password || !local.database)) {
      try {
        const u = new URL(url.replace(/^postgresql:\/\//, 'postgres://'))
        local.user = local.user || u.username || null
        local.password = local.password || u.password || null
        local.database = local.database || (u.pathname || '').replace('/', '') || null
      } catch {}
    }
  }
  return local
}

async function main() {
  let superUrl = process.env.DATABASE_URL
  if (!superUrl) {
    console.error('[create-pos-user] DATABASE_URL not set in .env.migration')
    process.exit(1)
  }
  if (superUrl.startsWith('postgresql://')) {
    superUrl = superUrl.replace(/^postgresql:\/\//, 'postgres://')
  }

  const desired = parseLocalEnv()
  const role = desired.user || 'pos_user'
  const password = desired.password || 'posdev'
  const dbName = desired.database || 'pos_db'

  const masked = (() => {
    try {
      const u = new URL(superUrl)
      const pw = u.password ? '***' : ''
      const auth = u.username + (pw ? ':' + pw : '')
      return `${u.protocol}//${auth}@${u.hostname}:${u.port}${u.pathname}`
    } catch { return '(hidden)' }
  })()
  console.log('[create-pos-user] Connecting with .env.migration DATABASE_URL:', masked)

  const client = new Client({ connectionString: superUrl })
  try {
    await client.connect()
    const who = await client.query('SELECT current_user, current_database()')
    console.log('[create-pos-user] Connected as:', who.rows[0])

    console.log(`[create-pos-user] Ensuring role "${role}" exists`)
    await client.query(`DO $$\nBEGIN\n  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role}') THEN\n    CREATE USER ${role} WITH PASSWORD '${password}';\n  ELSE\n    ALTER ROLE ${role} WITH PASSWORD '${password}';\n  END IF;\nEND\n$$;`)

    console.log(`[create-pos-user] Granting ALL PRIVILEGES on database ${dbName} to ${role}`)
    await client.query(`GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${role}`)

    console.log('[create-pos-user] Granting USAGE, CREATE on schema public')
    await client.query('GRANT USAGE ON SCHEMA public TO ' + role)
    await client.query('GRANT CREATE ON SCHEMA public TO ' + role)

    console.log('[create-pos-user] Granting DML on all tables in public')
    await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ' + role)

    console.log('[create-pos-user] Setting default privileges for future tables')
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`)

    const check = await client.query(
      `SELECT\n         has_schema_privilege('${role}', 'public', 'USAGE') AS has_usage,\n         has_schema_privilege('${role}', 'public', 'CREATE') AS has_create`
    )
    console.log('[create-pos-user] Privilege check:', check.rows[0])
    console.log('[create-pos-user] Done')
  } catch (err) {
    console.error('[create-pos-user] Error:', err.message || err)
    if (err.code) console.error('[create-pos-user] SQLSTATE:', err.code)
    process.exit(2)
  } finally {
    try { await client.end() } catch {}
  }
}

main()