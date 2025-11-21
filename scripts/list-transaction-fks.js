'use strict'

const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const db = require('../lib/sequelize')

async function main() {
  try {
    await db.sequelize.authenticate()
    const dialect = db.sequelize.getDialect()
    if (dialect !== 'postgres') {
      console.log('[List FKs] Not Postgres')
      process.exit(0)
    }
    const sql = `
      SELECT conname as constraint_name,
             pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = '"Transaction"'::regclass
        AND contype = 'f'
    `
    const [rows] = await db.sequelize.query(sql)
    console.log('[List FKs] Transaction FKs:', rows)
    process.exit(0)
  } catch (err) {
    console.error('[List FKs] Error:', err)
    process.exit(1)
  } finally {
    try { await db.sequelize.close() } catch {}
  }
}

main()