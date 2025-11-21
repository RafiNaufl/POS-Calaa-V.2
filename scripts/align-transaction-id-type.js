'use strict'

const db = require('../lib/sequelize')

async function main() {
  try {
    await db.sequelize.authenticate()
    console.log('[Align Types] Connected')

    // Alter Transaction.id to VARCHAR(255)
    await db.sequelize.query(`ALTER TABLE "Transaction" ALTER COLUMN "id" TYPE VARCHAR(255) USING "id"::varchar(255);`)
    console.log('[Align Types] Transaction.id -> VARCHAR(255)')

    // Alter TransactionItem.transactionId to VARCHAR(255)
    await db.sequelize.query(`ALTER TABLE "TransactionItem" ALTER COLUMN "transactionId" TYPE VARCHAR(255) USING "transactionId"::varchar(255);`)
    console.log('[Align Types] TransactionItem.transactionId -> VARCHAR(255)')

    // Verify
    const [txnRows] = await db.sequelize.query(
      `select data_type from information_schema.columns where table_schema='public' and table_name='Transaction' and column_name='id'`
    )
    const [tiRows] = await db.sequelize.query(
      `select data_type from information_schema.columns where table_schema='public' and table_name='TransactionItem' and column_name='transactionId'`
    )
    console.log('[Align Types] Types:', { Transaction_id: txnRows?.[0]?.data_type, TransactionItem_transactionId: tiRows?.[0]?.data_type })
    process.exit(0)
  } catch (err) {
    console.error('[Align Types] Error:', err)
    process.exit(1)
  } finally {
    await db.sequelize.close()
  }
}

main()