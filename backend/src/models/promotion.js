'use strict';
const { Model } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  class Promotion extends Model {
    static associate(models) {
      // Define associations here
      Promotion.hasMany(models.ProductPromotion, {
        foreignKey: 'promotionId',
        as: 'productPromotions'
      });
      Promotion.hasMany(models.CategoryPromotion, {
        foreignKey: 'promotionId',
        as: 'categoryPromotions'
      });
    }
  }
  
  Promotion.init({
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4().replace(/-/g, ''),
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
      type: DataTypes.ENUM('PRODUCT_DISCOUNT', 'CATEGORY_DISCOUNT', 'BULK_DISCOUNT', 'BUY_X_GET_Y'),
      allowNull: false
    },
    discountType: {
      type: DataTypes.ENUM('PERCENTAGE', 'FIXED'),
      allowNull: false,
      defaultValue: 'PERCENTAGE'
    },
    discountValue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    minQuantity: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    buyQuantity: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    getQuantity: {
      type: DataTypes.INTEGER,
      allowNull: true
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
    modelName: 'Promotion',
    tableName: 'promotions',
    timestamps: true
  });
  
  return Promotion;
};