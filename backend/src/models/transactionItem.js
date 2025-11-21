const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const TransactionItem = sequelize.define('TransactionItem', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4().replace(/-/g, ''),
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    subtotal: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    transactionId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Transaction',
        key: 'id',
      },
    },
    productId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Product',
        key: 'id',
      },
    },
  }, {
    tableName: 'TransactionItem',
    timestamps: false,
    indexes: [
      {
        fields: ['transactionId'],
      },
      {
        fields: ['productId'],
      },
      {
        fields: ['transactionId', 'productId'],
      },
    ],
    hooks: {
      beforeCreate: (transactionItem, options) => {
        // Calculate subtotal if not provided
        if (!transactionItem.subtotal) {
          transactionItem.subtotal = transactionItem.quantity * transactionItem.price;
        }
      },
      beforeUpdate: (transactionItem, options) => {
        // Recalculate subtotal if quantity or price changed
        if (transactionItem.changed('quantity') || transactionItem.changed('price')) {
          transactionItem.subtotal = transactionItem.quantity * transactionItem.price;
        }
      },
    },
  });

  TransactionItem.associate = (models) => {
    // Belongs to Product
    TransactionItem.belongsTo(models.Product, {
      foreignKey: 'productId',
      as: 'product',
    });

    // Belongs to Transaction
    TransactionItem.belongsTo(models.Transaction, {
      foreignKey: 'transactionId',
      as: 'transaction',
    });
  };

  // Instance methods
  TransactionItem.prototype.calculateSubtotal = function() {
    this.subtotal = this.quantity * this.price;
    return this.subtotal;
  };

  // Class methods
  TransactionItem.findByTransaction = function(transactionId) {
    return this.findAll({
      where: { transactionId },
      include: [
        {
          model: sequelize.models.Product,
          as: 'product',
        },
      ],
    });
  };

  TransactionItem.findByProduct = function(productId) {
    return this.findAll({
      where: { productId },
      include: [
        {
          model: sequelize.models.Transaction,
          as: 'transaction',
        },
      ],
    });
  };

  TransactionItem.getTotalSoldByProduct = function(productId, startDate, endDate) {
    const whereClause = { productId };
    
    if (startDate || endDate) {
      whereClause['$transaction.createdAt$'] = {};
      if (startDate) whereClause['$transaction.createdAt$'][sequelize.Op.gte] = startDate;
      if (endDate) whereClause['$transaction.createdAt$'][sequelize.Op.lte] = endDate;
    }

    return this.sum('quantity', {
      where: whereClause,
      include: [
        {
          model: sequelize.models.Transaction,
          as: 'transaction',
          attributes: [],
        },
      ],
    });
  };

  return TransactionItem;
};