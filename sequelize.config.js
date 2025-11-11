
require('dotenv').config({ path: '.env.migration' });

module.exports = {
  development: {
    dialect: process.env.SEQUELIZE_DIALECT || 'sqlite',
    storage: process.env.SEQUELIZE_STORAGE || './prisma/dev_sequelize.db',
    logging: process.env.MIGRATION_ENABLE_LOGGING === 'true' ? console.log : false,
    pool: {
      max: parseInt(process.env.MAX_CONNECTIONS) || 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  production: {
    dialect: process.env.SEQUELIZE_DIALECT || 'sqlite',
    storage: process.env.SEQUELIZE_STORAGE || './prisma/dev_sequelize.db',
    logging: false,
    pool: {
      max: parseInt(process.env.MAX_CONNECTIONS) || 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
};
