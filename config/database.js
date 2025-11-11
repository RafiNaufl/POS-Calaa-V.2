require('dotenv').config();

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: './database/dev.db',
    logging: console.log,
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false
    }
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false
  },
  production: {
    dialect: 'sqlite',
    storage: process.env.DATABASE_PATH || './database/production.db',
    logging: false,
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false
    }
  }
};