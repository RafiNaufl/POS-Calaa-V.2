const { Sequelize } = require('sequelize');
// Load env from .env and prefer .env.local jika tidak diminta untuk skip
try {
  if (!process.env.SKIP_SEQUELIZE_ENV_LOAD) {
    require('dotenv').config();
    const fs = require('fs');
    if (fs.existsSync('.env.local')) {
      require('dotenv').config({ path: '.env.local', override: true });
    }
  }
} catch {}

// Resolve Postgres connection URL
const pickTruthy = (v) => ['true', '1', 'yes'].includes(String(v || '').toLowerCase());
const enableSSL = pickTruthy(process.env.PGSSL || process.env.PG_SSL || process.env.POSTGRES_SSL);

// Use only DATABASE_URL as the primary source for connection string
let databaseUrl = process.env.DATABASE_URL || null;

// In development, guard against Prisma Data Proxy URLs which are incompatible with pg/Sequelize
try {
  const isPrismaProxy = databaseUrl && (
    String(databaseUrl).startsWith('prisma+postgres://') ||
    /accelerate\.prisma-data\.net/.test(String(databaseUrl))
  );
  if (isPrismaProxy && process.env.NODE_ENV !== 'production') {
    const fs = require('fs');
    const path = require('path');
    const localEnvPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(localEnvPath)) {
      const content = fs.readFileSync(localEnvPath, 'utf8');
      const match = content.match(/^DATABASE_URL=(?:"|')?(.*?)(?:"|')?$/m);
      if (match && match[1]) {
        databaseUrl = match[1];
        console.log('[Sequelize] Overriding Prisma Data Proxy URL with .env.local DATABASE_URL for dev');
      }
    }
  }
} catch {}

let sequelize;

// Helper to detect a valid Postgres-style URL
const isPostgresUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return /^postgres:\/\//.test(url) || /^postgresql:\/\//.test(url) || /^prisma\+postgres:\/\//.test(url);
};

// Always prefer lightweight in-memory DB during test runs unless explicitly overridden
if (process.env.NODE_ENV === 'test' && String(process.env.TEST_DB_DIALECT || '').toLowerCase() !== 'postgres') {
  console.log('[Sequelize] Using in-memory SQLite for tests');
  sequelize = new Sequelize('sqlite::memory:', {
    dialect: 'sqlite',
    logging: false,
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false,
    },
  });
} else if (!databaseUrl || !isPostgresUrl(databaseUrl)) {
  // Support individual env vars as fallback
  // Support individual env vars as fallback
  const host = process.env.PGHOST || '127.0.0.1';
  const port = process.env.PGPORT || '5432';
  const user = process.env.PGUSER || 'postgres';
  const password = process.env.PGPASSWORD || '';
  const database = process.env.PGDATABASE || 'pos_db';
  const auth = password ? `${user}:${password}` : user;
  // Normalize protocol to standard postgres scheme
  const url = `postgres://${auth}@${host}:${port}/${database}`;

  // Basic visibility for debugging connection issues (no secrets)
  try {
    const u = new URL(url);
    console.log('[Sequelize] init (fallback env):', {
      host: u.hostname,
      port: u.port,
      db: u.pathname.replace('/', ''),
      user: u.username,
      ssl: enableSSL ? 'enabled' : 'disabled',
    });
  } catch {}

  sequelize = new Sequelize(url, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: enableSSL
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false,
    },
  });
} else {
  // Normalize DATABASE_URL protocols to a Sequelize-supported scheme
  let normalizedUrl = databaseUrl;
  if (normalizedUrl.startsWith('prisma+postgres://')) {
    normalizedUrl = normalizedUrl.replace(/^prisma\+postgres:\/\//, 'postgres://');
  } else if (normalizedUrl.startsWith('postgresql://')) {
    normalizedUrl = normalizedUrl.replace(/^postgresql:\/\//, 'postgres://');
  }
  // Normalize localhost to IPv4 to avoid IPv6 socket quirks
  normalizedUrl = normalizedUrl.replace('://localhost:', '://127.0.0.1:');

  try {
    const u = new URL(normalizedUrl);
    console.log('[Sequelize] init (DATABASE_URL):', {
      host: u.hostname,
      port: u.port,
      db: u.pathname.replace('/', ''),
      user: u.username,
      ssl: enableSSL ? 'enabled' : 'disabled',
    });
  } catch {}

  sequelize = new Sequelize(normalizedUrl, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: enableSSL
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false,
    },
  });
}

// Test the connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Postgres connection established successfully.');
  } catch (error) {
    console.error('Unable to connect to Postgres:', error);
  }
};

module.exports = { sequelize, testConnection };
