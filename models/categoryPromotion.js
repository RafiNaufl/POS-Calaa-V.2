'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CategoryPromotion extends Model {
    static associate(models) {
      // Define associations here
      CategoryPromotion.belongsTo(models.Category, {
        foreignKey: 'categoryId',
        as: 'category'
      });
      CategoryPromotion.belongsTo(models.Promotion, {
        foreignKey: 'promotionId',
        as: 'promotion'
      });
    }
  }
  
  CategoryPromotion.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    categoryId: {
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
    modelName: 'CategoryPromotion',
    tableName: 'category_promotions',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['categoryId', 'promotionId']
      }
    ]
  });
  
  return CategoryPromotion;
};