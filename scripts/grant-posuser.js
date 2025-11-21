// Grant CREATE/USAGE on schema public to posuser using superuser creds from .env.migration
const path = require('path');
const { Client } = require('pg');

// Load .env.migration explicitly and OVERRIDE existing env to ensure superuser creds are used
require('dotenv').config({ path: path.join(process.cwd(), '.env.migration'), override: true });

let url = process.env.DATABASE_URL;

async function main() {
  if (!url) {
    console.error('[grant-posuser] DATABASE_URL not set in .env.migration');
    process.exit(1);
  }

  // Normalize protocol if needed and mask password in log
  if (url.startsWith('postgresql://')) {
    url = url.replace(/^postgresql:\/\//, 'postgres://');
  }
  const masked = (() => {
    try {
      const u = new URL(url);
      const pw = u.password ? '***' : '';
      const auth = u.username + (pw ? ':' + pw : '');
      return `${u.protocol}//${auth}@${u.hostname}:${u.port}${u.pathname}`;
    } catch { return '(hidden)'; }
  })();
  console.log('[grant-posuser] Connecting with .env.migration DATABASE_URL:', masked);
  const client = new Client({ connectionString: url });

  try {
    await client.connect();
    const who = await client.query('SELECT current_user, current_database()');
    console.log('[grant-posuser] Connected as:', who.rows[0]);

    // Grant USAGE and CREATE privileges on public schema to posuser
    console.log('[grant-posuser] Granting USAGE on schema public to posuser');
    await client.query('GRANT USAGE ON SCHEMA public TO posuser');

    console.log('[grant-posuser] Granting CREATE on schema public to posuser');
    await client.query('GRANT CREATE ON SCHEMA public TO posuser');

    // Show privilege check
    const check = await client.query(
      `SELECT 
         has_schema_privilege('posuser', 'public', 'USAGE') AS has_usage,
         has_schema_privilege('posuser', 'public', 'CREATE') AS has_create`
    );
    console.log('[grant-posuser] Privilege check:', check.rows[0]);

    console.log('[grant-posuser] Done');
  } catch (err) {
    console.error('[grant-posuser] Error:', err.message || err);
    if (err.code) console.error('[grant-posuser] SQLSTATE:', err.code);
    process.exit(2);
  } finally {
    try { await client.end(); } catch {}
  }
}

main();