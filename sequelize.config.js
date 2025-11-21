
require('dotenv').config({ path: '.env.migration' });

const pickTruthy = (v) => ['true', '1', 'yes'].includes(String(v || '').toLowerCase());
const enableSSL = pickTruthy(process.env.PGSSL || process.env.PG_SSL || process.env.POSTGRES_SSL);

const base = {
  dialect: 'postgres',
  use_env_variable: 'DATABASE_URL',
  logging: process.env.MIGRATION_ENABLE_LOGGING === 'true' ? console.log : false,
  dialectOptions: enableSSL ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  pool: {
    max: parseInt(process.env.MAX_CONNECTIONS) || 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
}

module.exports = {
  development: { ...base },
  production: { ...base, logging: false },
};
