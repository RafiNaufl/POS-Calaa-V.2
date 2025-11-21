// Development-only schema sync using superuser credentials from .env.migration
// This script creates missing tables in the target Postgres database so that
// the Next.js app (which may use a limited user) can query them.

/*
  Usage:
    node scripts/dev-schema-sync.js

  What it does:
  - Loads env from .env.migration (postgres superuser by default)
  - Imports the real Sequelize models from ./models
  - Synchronizes tables in dependency order
  - Prints a summary of tables after sync

  Safe for local development only. Do NOT run in production.
*/

const path = require('path');
const dotenv = require('dotenv');

// Load superuser DATABASE_URL for local schema creation, overriding any existing env
dotenv.config({ path: path.join(process.cwd(), '.env.migration'), override: true });

// Prevent Sequelize loader from reloading .env/.env.local and overriding superuser creds
process.env.SKIP_SEQUELIZE_ENV_LOAD = '1';

const db = require('../models');

async function listTables() {
  try {
    const [rows] = await db.sequelize.query(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = current_schema()`
    );
    return rows.map(r => r.tablename);
  } catch (err) {
    console.error('Failed to list tables:', err.message);
    return null;
  }
}

async function main() {
  const cfg = db.sequelize.config || {};
  console.log('[Dev Sync] Connecting as:', {
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    username: cfg.username,
    dialect: db.sequelize.getDialect(),
  });

  try {
    await db.sequelize.authenticate();
    console.log('[Dev Sync] Connection OK');
  } catch (err) {
    console.error('[Dev Sync] Connection failed:', err.message);
    process.exit(2);
  }

  // Sync in dependency order to avoid FK creation issues
  const order = [
    'User',
    'Category',
    'Member',
    'Product',
    'Voucher',
    'Promotion',
    'Transaction',
    'TransactionItem',
    'VoucherUsage',
    'PointHistory',
    'ProductPromotion',
    'CategoryPromotion',
    'OperationalExpense',
    'CashierShift',
    'CashierShiftLog',
  ];

  try {
    for (const name of order) {
      const model = db[name];
      if (!model || typeof model.sync !== 'function') continue;
      const useAlter = ['Member', 'Voucher'].includes(name);
      console.log(`[Dev Sync] Syncing ${name}...${useAlter ? ' (alter columns if needed)' : ''}`);
      if (useAlter) {
        await model.sync({ alter: true });
      } else {
        await model.sync();
      }
      console.log(`[Dev Sync] ✔ ${name} synced`);
    }
  } catch (err) {
    console.error('[Dev Sync] Sync failed:', err);
    process.exit(3);
  }

  try {
    console.log('[Dev Sync] Listing tables...');
    const tables = await listTables();
    console.log('[Dev Sync] Tables:', tables);
  } catch {}

  await db.sequelize.close().catch(() => {});
  console.log('[Dev Sync] Done');
}

main().catch(err => {
  console.error('[Dev Sync] Unexpected error:', err);
  process.exit(1);
});
