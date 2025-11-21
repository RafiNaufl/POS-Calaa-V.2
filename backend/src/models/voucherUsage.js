'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class VoucherUsage extends Model {
    static associate(models) {
      // Define associations here
      VoucherUsage.belongsTo(models.Voucher, {
        foreignKey: 'voucherId',
        as: 'voucher'
      });
      VoucherUsage.belongsTo(models.Transaction, {
        foreignKey: 'transactionId',
        as: 'transaction'
      });
      VoucherUsage.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      });
      VoucherUsage.belongsTo(models.Member, {
        foreignKey: 'memberId',
        as: 'member'
      });
    }
  }
  
  VoucherUsage.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    voucherId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'vouchers',
        key: 'id'
      }
    },
    transactionId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Transaction',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    memberId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'members',
        key: 'id'
      }
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'VoucherUsage',
    tableName: 'voucher_usages',
    timestamps: true
  });
  
  return VoucherUsage;
};