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
      console.log('[Fix userId] Not Postgres, nothing to do')
      process.exit(0)
    }

    const [rows] = await db.sequelize.query(
      `select table_name, column_name, data_type
       from information_schema.columns
       where table_schema = current_schema()
         and table_name = 'Transaction'
         and column_name = 'userId'`
    )
    const col = Array.isArray(rows) ? rows[0] : null
    console.log('[Fix userId] Current type:', col?.data_type)
    if (!col) {
      console.log('[Fix userId] Column not found')
      process.exit(2)
    }

    if (col.data_type === 'integer') {
      console.log('[Fix userId] Already integer')
      process.exit(0)
    }

    console.log('[Fix userId] Altering "Transaction"."userId" to integer...')
    await db.sequelize.query('ALTER TABLE "Transaction" ALTER COLUMN "userId" TYPE integer USING "userId"::integer')
    console.log('[Fix userId] Done')
    process.exit(0)
  } catch (err) {
    console.error('[Fix userId] Error:', err)
    process.exit(1)
  } finally {
    try { await db.sequelize.close() } catch {}
  }
}

main()