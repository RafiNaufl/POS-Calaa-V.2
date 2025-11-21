'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductPromotion extends Model {
    static associate(models) {
      // Define associations here
      ProductPromotion.belongsTo(models.Product, {
        foreignKey: 'productId',
        as: 'product'
      });
      ProductPromotion.belongsTo(models.Promotion, {
        foreignKey: 'promotionId',
        as: 'promotion'
      });
    }
  }
  
  ProductPromotion.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    productId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    promotionId: {
      type: DataTypes.STRING,
      allowNull: false
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
    modelName: 'ProductPromotion',
    tableName: 'product_promotions',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['productId', 'promotionId']
      }
    ]
  });
  
  return ProductPromotion;
};