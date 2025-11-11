const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../lib/sequelize');

// Import models
const Category = require('./category')(sequelize, DataTypes);
const Product = require('./product')(sequelize, DataTypes);
const Transaction = require('./transaction')(sequelize, DataTypes);
const TransactionItem = require('./transactionItem')(sequelize, DataTypes);
const User = require('./user')(sequelize, DataTypes);
const Member = require('./member')(sequelize, DataTypes);
const Voucher = require('./voucher')(sequelize, DataTypes);
const VoucherUsage = require('./voucherUsage')(sequelize, DataTypes);
const PointHistory = require('./pointHistory')(sequelize, DataTypes);
const Promotion = require('./promotion')(sequelize, DataTypes);
const ProductPromotion = require('./productPromotion')(sequelize, DataTypes);
const CategoryPromotion = require('./categoryPromotion')(sequelize, DataTypes);
const OperationalExpense = require('./operationalExpense')(sequelize, DataTypes);

// Define associations - removed duplicate Category-Product association as it's handled in model associate methods

// Export models and sequelize instance
const db = {
  sequelize,
  Sequelize,
  Category,
  Product,
  Transaction,
  TransactionItem,
  User,
  Member,
  Voucher,
  VoucherUsage,
  PointHistory,
  Promotion,
  ProductPromotion,
  CategoryPromotion,
  OperationalExpense
};

// Set up associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;