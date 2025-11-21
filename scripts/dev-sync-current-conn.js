// Dev schema sync using the app's current DB connection (e.g., posuser)
// This script attempts to create missing tables in dependency order
// using whatever credentials the app is currently configured with.

const db = require('../models');

async function listTables() {
  try {
    const [rows] = await db.sequelize.query(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = current_schema()`
    );
    return rows.map(r => r.tablename);
  } catch (err) {
    return null;
  }
}

async function main() {
  const cfg = db.sequelize.config || {};
  console.log('[Dev Sync Current] Connecting as:', {
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    username: cfg.username,
    dialect: db.sequelize.getDialect(),
  });

  try {
    await db.sequelize.authenticate();
    console.log('[Dev Sync Current] Connection OK');
  } catch (err) {
    console.error('[Dev Sync Current] Connection failed:', err.message);
    process.exit(2);
  }

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
      console.log(`[Dev Sync Current] Syncing ${name}...`);
      await model.sync();
      console.log(`[Dev Sync Current] ✔ ${name} synced`);
    }
  } catch (err) {
    console.error('[Dev Sync Current] Sync failed:', err);
    process.exit(3);
  }

  try {
    const tables = await listTables();
    console.log('[Dev Sync Current] Tables:', tables);
  } catch {}

  await db.sequelize.close().catch(() => {});
  console.log('[Dev Sync Current] Done');
}

main().catch(err => {
  console.error('[Dev Sync Current] Unexpected error:', err);
  process.exit(1);
});