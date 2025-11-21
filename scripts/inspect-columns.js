const { Client } = require('pg');

(async () => {
  const cfg = {
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'posuser',
    database: process.env.PGDATABASE || 'pos_db',
  };
  if (process.env.PGPASSWORD) cfg.password = process.env.PGPASSWORD;
  const client = new Client(cfg);
  await client.connect();
  const q = `
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_name IN ('Transaction','TransactionItem')
      AND column_name IN ('id','transactionId','userId')
    ORDER BY table_name, column_name;
  `;
  const res = await client.query(q);
  console.log('[Inspect Columns] Rows:', res.rows);
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});