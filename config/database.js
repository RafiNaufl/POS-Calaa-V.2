require('dotenv').config();

const pickTruthy = (v) => ['true', '1', 'yes'].includes(String(v || '').toLowerCase());
const enableSSL = pickTruthy(process.env.PGSSL || process.env.PG_SSL || process.env.POSTGRES_SSL);

const base = {
  dialect: 'postgres',
  use_env_variable: 'DATABASE_URL',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  dialectOptions: enableSSL ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: false,
  },
}

module.exports = {
  development: { ...base },
  test: { ...base, logging: false },
  production: { ...base, logging: false },
};