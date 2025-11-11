const { Sequelize } = require('sequelize');
require('dotenv').config();

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.NODE_ENV === 'production' 
    ? './database/production.db' 
    : './database/dev.db',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  // Provide sqlite3 module directly to avoid dynamic require issues in Next bundling
  dialectModule: require('sqlite3'),
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: false
  }
});

// Test the connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

module.exports = { sequelize, testConnection };