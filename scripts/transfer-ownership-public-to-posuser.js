// Transfer ownership of schema public and its objects to posuser using superuser creds from .env.migration
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(process.cwd(), '.env.migration'), override: true });

let url = process.env.DATABASE_URL;
if (!url) {
  console.error('[transfer-ownership] DATABASE_URL not set in .env.migration');
  process.exit(1);
}
if (url.startsWith('postgresql://')) url = url.replace(/^postgresql:\/\//, 'postgres://');

const client = new Client({ connectionString: url });

async function alterSchemaOwner() {
  console.log('[transfer-ownership] Altering schema public owner to posuser');
  await client.query('ALTER SCHEMA public OWNER TO posuser');
}

async function alterTablesOwner() {
  const { rows } = await client.query(
    `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'`
  );
  for (const r of rows) {
    const name = r.tablename;
    console.log(`[transfer-ownership] Alter TABLE ${name} owner -> posuser`);
    await client.query(`ALTER TABLE "public"."${name}" OWNER TO posuser`);
  }
}

async function alterSequencesOwner() {
  const { rows } = await client.query(
    `SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public'`
  );
  for (const r of rows) {
    const name = r.sequence_name;
    console.log(`[transfer-ownership] Alter SEQUENCE ${name} owner -> posuser`);
    await client.query(`ALTER SEQUENCE "public"."${name}" OWNER TO posuser`);
  }
}

async function alterEnumsOwner() {
  const { rows } = await client.query(
    `SELECT t.typname AS type_name
     FROM pg_type t
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname='public' AND t.typtype='e'`
  );
  for (const r of rows) {
    const name = r.type_name;
    console.log(`[transfer-ownership] Alter TYPE ${name} owner -> posuser`);
    await client.query(`ALTER TYPE "public"."${name}" OWNER TO posuser`);
  }
}

async function main() {
  try {
    await client.connect();
    const who = await client.query('SELECT current_user, current_database()');
    console.log('[transfer-ownership] Connected as:', who.rows[0]);

    await alterSchemaOwner().catch(err => console.warn('[transfer-ownership] Schema owner alter warning:', err.message));
    await alterTablesOwner();
    await alterSequencesOwner();
    await alterEnumsOwner();

    console.log('[transfer-ownership] Done');
  } catch (err) {
    console.error('[transfer-ownership] Error:', err.message || err);
    if (err.code) console.error('[transfer-ownership] SQLSTATE:', err.code);
    process.exit(2);
  } finally {
    try { await client.end(); } catch {}
  }
}

main();