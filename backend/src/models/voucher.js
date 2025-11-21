'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Voucher extends Model {
    static associate(models) {
      // Define associations here
      Voucher.hasMany(models.VoucherUsage, {
        foreignKey: 'voucherId',
        as: 'usages'
      });
    }
  }
  
  Voucher.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('percentage', 'fixed', 'free_shipping'),
      allowNull: false
    },
    value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    minPurchase: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    maxDiscount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    maxUses: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // New: per-user usage limit (nullable)
    maxUsesPerUser: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    usedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
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
    modelName: 'Voucher',
    tableName: 'vouchers',
    timestamps: true
  });
  
  return Voucher;
};
