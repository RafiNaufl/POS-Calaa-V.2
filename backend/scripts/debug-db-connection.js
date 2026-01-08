const { Client } = require('pg');

const OLD_DB_URL = 'postgresql://postgres:mZYHaKQSYUAWjCXNwWyECSqVBfccwEah@gondola.proxy.rlwy.net:23049/railway';

async function testConnection(sslConfig) {
  console.log(`Testing with SSL config:`, sslConfig);
  const client = new Client({
    connectionString: OLD_DB_URL,
    ssl: sslConfig,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully!');
    const res = await client.query('SELECT NOW()');
    console.log('Result:', res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    if (err.code) console.error('Code:', err.code);
    return false;
  }
}

async function run() {
  console.log('--- Test 1: rejectUnauthorized: false ---');
  if (await testConnection({ rejectUnauthorized: false })) return;

  console.log('\n--- Test 2: true (require SSL) ---');
  if (await testConnection(true)) return;

  console.log('\n--- Test 3: No SSL ---');
  if (await testConnection(false)) return;

  console.log('\n--- Test 4: rejectUnauthorized: false + requestCert: true ---');
  if (await testConnection({ rejectUnauthorized: false, requestCert: true })) return;
}

run();
