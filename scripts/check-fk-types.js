'use strict'

const path = require('path')
const dotenv = require('dotenv')

// Load app env for current connection (DATABASE_URL prioritized by lib/sequelize.js)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const db = require('../lib/sequelize')

async function main() {
  try {
    await db.sequelize.authenticate()
    const [whoRows] = await db.sequelize.query('select current_user, current_database()')
    console.log('[Check FK Types] Connected as:', whoRows?.[0] || whoRows)

    const [voucherRows] = await db.sequelize.query(
      `select table_name, column_name, data_type
       from information_schema.columns
       where table_schema = 'public' and table_name = 'voucher_usages' and column_name = 'transactionId'`
    )
    const voucherFk = voucherRows?.[0]
    const [txnRows] = await db.sequelize.query(
      `select table_name, column_name, data_type
       from information_schema.columns
       where table_schema = 'public' and table_name = 'Transaction' and column_name = 'id'`
    )
    const txnPk = txnRows?.[0]

    const [tiRows] = await db.sequelize.query(
      `select table_name, column_name, data_type
       from information_schema.columns
       where table_schema = 'public' and table_name = 'TransactionItem' and column_name = 'transactionId'`
    )
    const tiFk = tiRows?.[0]

    const [txnUserIdRows] = await db.sequelize.query(
      `select table_name, column_name, data_type
       from information_schema.columns
       where table_schema = 'public' and table_name = 'Transaction' and column_name = 'userId'`
    )
    const txnUserId = txnUserIdRows?.[0]

    const [txnMemberIdRows] = await db.sequelize.query(
      `select table_name, column_name, data_type
       from information_schema.columns
       where table_schema = 'public' and table_name = 'Transaction' and column_name = 'memberId'`
    )
    const txnMemberId = txnMemberIdRows?.[0]

    console.log('[Check FK Types] voucher_usages.transactionId:', voucherFk?.data_type || 'N/A', voucherFk || {})
    console.log('[Check FK Types] TransactionItem.transactionId:', tiFk?.data_type || 'N/A', tiFk || {})
    console.log('[Check FK Types] Transaction.id:', txnPk?.data_type || 'N/A', txnPk || {})
    console.log('[Check FK Types] Transaction.userId:', txnUserId?.data_type || 'N/A', txnUserId || {})
    console.log('[Check FK Types] Transaction.memberId:', txnMemberId?.data_type || 'N/A', txnMemberId || {})

    if (voucherFk?.data_type && txnPk?.data_type && tiFk?.data_type && voucherFk.data_type === txnPk.data_type && tiFk.data_type === txnPk.data_type) {
      console.log('[Check FK Types] OK: Matching types')
      process.exit(0)
    } else {
      console.error('[Check FK Types] MISMATCH: Types differ')
      process.exit(2)
    }
  } catch (err) {
    console.error('[Check FK Types] Error:', err)
    process.exit(1)
  } finally {
    await db.sequelize.close()
  }
}

main()