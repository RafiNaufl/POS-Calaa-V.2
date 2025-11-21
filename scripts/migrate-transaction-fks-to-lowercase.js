'use strict'

const path = require('path')
const dotenv = require('dotenv')
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const db = require('../backend/src/lib/sequelize')

async function main() {
  try {
    await db.sequelize.authenticate()
    const dialect = db.sequelize.getDialect()
    if (dialect !== 'postgres') {
      console.log('[Migrate FKs] Not Postgres, aborting')
      process.exit(0)
    }

    // Drop old FKs if they reference uppercase tables
    const [fkRows] = await db.sequelize.query(`
      SELECT conname as name, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = '"Transaction"'::regclass
        AND contype = 'f'
    `)
    for (const fk of fkRows) {
      if (fk.def.includes('REFERENCES "User"') || fk.def.includes('REFERENCES "Member"')) {
        console.log('[Migrate FKs] Dropping FK:', fk.name, fk.def)
        await db.sequelize.query(`ALTER TABLE "Transaction" DROP CONSTRAINT "${fk.name}"`)
      }
    }

    // Alter types to integer
    const [cols] = await db.sequelize.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'Transaction' AND column_name IN ('userId','memberId')
    `)
    for (const col of cols) {
      if (col.data_type !== 'integer') {
        console.log('[Migrate FKs] Altering column to integer:', col.column_name)
        await db.sequelize.query(`ALTER TABLE "Transaction" ALTER COLUMN "${col.column_name}" TYPE integer USING "${col.column_name}"::integer`)
      }
    }

    // Add new FKs to lowercase tables
    console.log('[Migrate FKs] Adding FK to users(id)')
    await db.sequelize.query(`ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT`)
    console.log('[Migrate FKs] Adding FK to members(id)')
    await db.sequelize.query(`ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES members(id) ON UPDATE CASCADE ON DELETE SET NULL`)

    console.log('[Migrate FKs] Completed')
    process.exit(0)
  } catch (err) {
    console.error('[Migrate FKs] Error:', err)
    process.exit(1)
  } finally {
    try { await db.sequelize.close() } catch {}
  }
}

main()