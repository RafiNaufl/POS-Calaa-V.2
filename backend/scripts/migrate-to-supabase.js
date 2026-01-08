const { Client } = require('pg');
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

const TABLES = [
  'User',
  'Category',
  'Member',
  'Voucher',
  'Promotion',
  'Product',
  'OperationalExpense',
  'CashierShift',
  'CashierShiftLog',
  'Transaction',
  'TransactionItem',
  'PointHistory',
  'VoucherUsage',
  'ProductPromotion',
  'CategoryPromotion'
];

async function migrate() {
  let OLD_DB_URL = process.env.OLD_DATABASE_URL;
  let NEW_DB_URL = process.env.DATABASE_URL;

  if (!NEW_DB_URL) {
    console.error('Error: DATABASE_URL (Supabase) is missing in .env');
    process.exit(1);
  }

  if (!OLD_DB_URL) {
    console.log('⚠️  OLD_DATABASE_URL is not set in .env');
    OLD_DB_URL = await prompt('Please enter the OLD Database URL (Render/Postgres): ');
    if (!OLD_DB_URL) {
      console.error('Error: Old Database URL is required to migrate data.');
      process.exit(1);
    }
  }

  // Connection Retry Loop
  let sourceConnected = false;
  let source;

  while (!sourceConnected) {
      source = new Client({ connectionString: OLD_DB_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
      try {
          console.log(`\nConnecting to OLD database (${OLD_DB_URL.split('@')[1] || '...'}) ...`);
          await source.connect();
          sourceConnected = true;
          console.log('✅ Connected to OLD database.');
      } catch (err) {
          console.error('❌ Connection failed:', err.message);
          if (err.code === 'ECONNRESET') {
              console.error('   Hint: The database might be sleeping, behind a proxy, or the port is incorrect.');
              console.error('   Hint: Check your Railway/Render dashboard for the latest connection string.');
          }
          
          const retry = await prompt('Do you want to enter a different URL? (y/n): ');
          if (retry.toLowerCase() === 'y') {
              OLD_DB_URL = await prompt('Enter new URL: ');
          } else {
              console.log('Skipping data migration (Schema sync only)...');
              await source.end().catch(() => {});
              return; // Exit migration function
          }
      }
  }

  const dest = new Client({ connectionString: NEW_DB_URL, ssl: { rejectUnauthorized: false } });

  try {
    console.log('Connecting to NEW database (Supabase)...');
    await dest.connect();
    console.log('✅ Connected to NEW database.');

    // 0. Disable Foreign Key Checks for the session (Replica Mode)
    // This allows inserting data in any order and handling circular dependencies or missing optional FKs gracefully during migration.
    try {
        console.log('Setting session_replication_role to replica (disabling FK checks)...');
        await dest.query("SET session_replication_role = 'replica';");
        console.log('✅ FK checks disabled for this session.');
    } catch (err) {
        console.warn('⚠️  Could not disable FK checks (might need superuser):', err.message);
        console.warn('   Proceeding with standard migration (order matters)...');
    }

    // 1. Check if source tables exist and handle case sensitivity
    // Postgres stores unquoted tables as lowercase. Sequelize often creates them quoted "Users".
    // We need to inspect the source DB schema first.
    console.log('Inspecting source database schema...');
    const schemaRes = await source.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const existingTables = schemaRes.rows.map(r => r.table_name);
    console.log('Found tables in source:', existingTables.join(', '));

    // 2. Map source tables to destination tables
    // Sequelize uses plural lowercase/camelCase table names by default.
    // We map known Source Tables (from DB inspection) to our Sequelize Model names.
    // Updated to match explicit tableName definitions in backend/src/models/*.js
    const MODEL_TO_TABLE_MAP = {
      'User': 'users',
      'Category': 'Category',
      'Member': 'members',
      'Voucher': 'vouchers',
      'Promotion': 'promotions',
      'Product': 'Product',
      'OperationalExpense': 'operational_expense',
      'CashierShift': 'CashierShift',
      'CashierShiftLog': 'CashierShiftLog',
      'Transaction': 'Transaction',
      'TransactionItem': 'TransactionItem',
      'PointHistory': 'PointHistories',
      'VoucherUsage': 'voucher_usages',
      'ProductPromotion': 'product_promotions',
      'CategoryPromotion': 'category_promotions'
    };
    
    // Special Source Map not needed if Source == Dest (which seems to be the case)

    for (const table of TABLES) {
      // Find the actual table name in source (case-insensitive match)
      // 1. Try exact Model name
      // 2. Try Mapped Destination name
      const sourceTableName = existingTables.find(t => t.toLowerCase() === table.toLowerCase()) 
                              || existingTables.find(t => t.toLowerCase() === (MODEL_TO_TABLE_MAP[table] || '').toLowerCase());
      
      if (!sourceTableName) {
        console.log(`⚠️  Table '${table}' not found in source database. Skipping.`);
        continue;
      }

      const destTableName = MODEL_TO_TABLE_MAP[table] || sourceTableName;
      console.log(`Migrating ${sourceTableName} -> ${destTableName}...`);
      
      // Get data from source using the actual table name
      const res = await source.query(`SELECT * FROM "${sourceTableName}"`);
      const rows = res.rows;
      
      if (rows.length === 0) {
        console.log(`  No data in ${sourceTableName}, skipping.`);
        continue;
      }
      
      // Insert into destination
      let insertedCount = 0;
      for (const row of rows) {
        const keys = Object.keys(row);
        const values = Object.values(row);
        
        const columns = keys.map(k => `"${k}"`).join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `
          INSERT INTO "${destTableName}" (${columns}) 
          VALUES (${placeholders})
          ON CONFLICT (id) DO NOTHING
        `;
        
        try {
          await dest.query(query, values);
          insertedCount++;
        } catch (err) {
            if (err.code === '42P01') { // undefined_table
                 console.error(`  ❌ Destination table "${destTableName}" missing. Did you run the backend to sync schema?`);
                 break;
            }
            console.error(`  ❌ Failed to insert row ${row.id}: ${err.message}`);
        }
      }
      console.log(`  ✅ Migrated ${insertedCount} rows from ${sourceTableName} to ${destTableName}.`);
    }

    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    // Restore FK checks (good practice, though connection end resets it usually)
    try {
        if (sourceConnected && dest) { // Simple check
             await dest.query("SET session_replication_role = 'origin';");
        }
    } catch (_) {}

    await source.end();
    await dest.end();
    rl.close();
  }
}

migrate();
