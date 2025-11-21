'use strict'

const path = require('path')
const dotenv = require('dotenv')
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const db = require('../lib/sequelize')

async function main() {
  try {
    await db.sequelize.authenticate()
    const [rows] = await db.sequelize.query(`
      select table_name, column_name, data_type
      from information_schema.columns
      where table_schema = current_schema()
        and table_name in ('User','users','Member','members')
        and column_name = 'id'
      order by table_name;
    `)
    console.log('[Inspect IDs] id column types:', rows)
    process.exit(0)
  } catch (err) {
    console.error('[Inspect IDs] Error:', err)
    process.exit(1)
  } finally {
    try { await db.sequelize.close() } catch {}
  }
}

main()