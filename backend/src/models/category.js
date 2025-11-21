const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Category = sequelize.define('Category', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4().replace(/-/g, ''),
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'Category',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['name'],
      },
    ],
    hooks: {
      beforeValidate: (category, options) => {
        if (category.name) {
          category.name = category.name.trim();
        }
      },
    },
  });

  Category.associate = (models) => {
    // Has many Products
    Category.hasMany(models.Product, {
      foreignKey: 'categoryId',
      as: 'products',
    });

    // Has many CategoryPromotions (if exists)
    if (models.CategoryPromotion) {
      Category.hasMany(models.CategoryPromotion, {
        foreignKey: 'categoryId',
        as: 'categoryPromotions',
      });
    }
  };

  // Instance methods
  Category.prototype.getProductCount = async function() {
    return await this.countProducts();
  };

  Category.prototype.getActiveProducts = async function() {
    return await this.getProducts({
      where: { isActive: true },
    });
  };

  // Class methods
  Category.findByName = function(name) {
    return this.findOne({
      where: { name },
    });
  };

  Category.getWithProductCount = function() {
    return this.findAll({
      attributes: [
        'id',
        'name',
        'description',
        'createdAt',
        'updatedAt',
        [sequelize.fn('COUNT', sequelize.col('products.id')), 'productCount'],
      ],
      include: [
        {
          model: sequelize.models.Product,
          as: 'products',
          attributes: [],
        },
      ],
      group: ['Category.id'],
    });
  };

  return Category;
};