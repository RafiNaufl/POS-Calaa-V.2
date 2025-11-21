// Quick Postgres connectivity check using the pg driver and DATABASE_URL
const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const ssl = process.env.PGSSL === 'true' || process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false;
  const client = new Client({ connectionString: url, ssl });
  try {
    await client.connect();
    const res = await client.query('SELECT version() AS v, current_database() AS db, current_user AS user');
    console.log({ ok: true, details: res.rows[0] });
  } catch (err) {
    console.error({ ok: false, code: err.code, message: err.message });
    process.exit(2);
  } finally {
    try { await client.end(); } catch {}
  }
}

main();