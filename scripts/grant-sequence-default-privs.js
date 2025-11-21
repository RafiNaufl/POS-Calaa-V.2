#!/usr/bin/env node
/**
 * Grants default privileges for sequences in schema public to POS roles
 * and ensures explicit INSERT privilege on PointHistories for POS roles.
 *
 * This uses .env.migration (superuser) to execute ALTER DEFAULT PRIVILEGES
 * so that future sequences are accessible, plus immediate grants on existing
 * sequences and PointHistories table.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load .env.migration first if present, then fallback to .env
const dotenv = require('dotenv');
const migrationEnvPath = path.join(process.cwd(), '.env.migration');
if (fs.existsSync(migrationEnvPath)) {
  dotenv.config({ path: migrationEnvPath });
} else {
  dotenv.config();
}

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
if (!DATABASE_URL) {
  console.error('[grant-sequence-default-privs] DATABASE_URL tidak ditemukan di env. Pastikan .env.migration tersedia.');
  process.exit(1);
}

const ROLES = ['pos_user', 'posuser']; // dukung kedua penamaan agar konsisten

async function main() {
  console.log('[grant-sequence-default-privs] Connecting with DATABASE_URL');
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const who = await client.query('SELECT current_user, current_database() AS current_database');
  console.log('[grant-sequence-default-privs] Connected as:', who.rows[0]);

  try {
    for (const role of ROLES) {
      console.log(`[grant-sequence-default-privs] ALTER DEFAULT PRIVILEGES for sequences -> ${role}`);
      // Default privileges for future sequences
      await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`);

      console.log(`[grant-sequence-default-privs] GRANT USAGE, SELECT on existing sequences in public -> ${role}`);
      // Immediate grants on all existing sequences
      await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);

      console.log(`[grant-sequence-default-privs] Ensure specific PointHistories_id_seq access -> ${role}`);
      // Specific sequence grant to avoid case issues
      await client.query('GRANT USAGE, SELECT ON SEQUENCE "PointHistories_id_seq" TO ' + role);

      console.log(`[grant-sequence-default-privs] GRANT INSERT on "PointHistories" -> ${role}`);
      // Explicit insert on table PointHistories (quoted to preserve case)
      await client.query('GRANT INSERT ON TABLE "PointHistories" TO ' + role);
    }

    console.log('[grant-sequence-default-privs] Privileges updated successfully for roles:', ROLES.join(', '));
  } catch (err) {
    console.error('[grant-sequence-default-privs] Error executing grants:', err.message);
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();