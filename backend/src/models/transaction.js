const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4().replace(/-/g, ''),
    },
    total: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    tax: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    discount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    voucherDiscount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    promoDiscount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    finalTotal: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    paymentMethod: {
      type: DataTypes.STRING,
      defaultValue: 'CASH',
      validate: {
        // Selaraskan dengan metode yang didukung di rute backend
        isIn: [['CASH', 'CARD', 'QRIS', 'BANK_TRANSFER', 'MIDTRANS', 'VIRTUAL_ACCOUNT']],
      },
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'COMPLETED',
      validate: {
        isIn: [['PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED']],
      },
    },
    paymentStatus: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['PENDING', 'PAID', 'FAILED', 'CANCELLED']],
      },
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    customerPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    customerEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    memberId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'members',
        key: 'id',
      },
    },
    pointsEarned: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    pointsUsed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    timestamps: true,
    tableName: 'Transaction',
    indexes: [
      {
        fields: ['userId'],
      },
      {
        fields: ['memberId'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['paymentMethod'],
      },
      {
        fields: ['createdAt'],
      },
      {
        fields: ['status', 'createdAt'],
      },
    ],
    hooks: {
      // Pastikan finalTotal dihitung sebelum validasi agar lolos not-null constraint
      beforeValidate: (transaction, options) => {
        if (transaction.finalTotal == null) {
          transaction.finalTotal = (transaction.total || 0) -
            (transaction.discount || 0) -
            (transaction.voucherDiscount || 0) -
            (transaction.promoDiscount || 0) +
            (transaction.tax || 0);
        }
      },
      beforeUpdate: (transaction, options) => {
        // Recalculate final total on update
        if (transaction.changed('total') || 
            transaction.changed('discount') || 
            transaction.changed('voucherDiscount') || 
            transaction.changed('promoDiscount') || 
            transaction.changed('tax')) {
          transaction.finalTotal = transaction.total - 
            (transaction.discount || 0) - 
            (transaction.voucherDiscount || 0) - 
            (transaction.promoDiscount || 0) + 
            (transaction.tax || 0);
        }
      },
    },
  });

  Transaction.associate = (models) => {
    // Belongs to User (if exists)
    if (models.User) {
      Transaction.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
    }

    // Belongs to Member (optional, if exists)
    if (models.Member) {
      Transaction.belongsTo(models.Member, {
        foreignKey: 'memberId',
        as: 'member',
      });
    }

    // Has many TransactionItems
    Transaction.hasMany(models.TransactionItem, {
      foreignKey: 'transactionId',
      as: 'items',
      onDelete: 'CASCADE',
    });

    // Has many VoucherUsages (if exists)
    if (models.VoucherUsage) {
      Transaction.hasMany(models.VoucherUsage, {
        foreignKey: 'transactionId',
        as: 'voucherUsages',
        onDelete: 'CASCADE',
      });
    }

    // Has many PointHistory (if exists)
    if (models.PointHistory) {
      Transaction.hasMany(models.PointHistory, {
        foreignKey: 'transactionId',
        as: 'pointHistory',
        onDelete: 'CASCADE',
      });
    }
  };

  // Instance methods
  Transaction.prototype.calculateTotal = function() {
    return this.total - 
      (this.discount || 0) - 
      (this.voucherDiscount || 0) - 
      (this.promoDiscount || 0) + 
      (this.tax || 0);
  };

  Transaction.prototype.isCompleted = function() {
    return this.status === 'COMPLETED';
  };

  Transaction.prototype.isPaid = function() {
    return this.paymentStatus === 'PAID';
  };

  // Class methods
  Transaction.findByDateRange = function(startDate, endDate, options = {}) {
    return this.findAll({
      where: {
        createdAt: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
        ...options.where,
      },
      ...options,
    });
  };

  Transaction.getTotalSales = async function(startDate, endDate) {
    const result = await this.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('finalTotal')), 'totalSales'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalTransactions'],
      ],
      where: {
        createdAt: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
        status: 'COMPLETED',
      },
      raw: true,
    });

    return result[0] || { totalSales: 0, totalTransactions: 0 };
  };

  return Transaction;
};