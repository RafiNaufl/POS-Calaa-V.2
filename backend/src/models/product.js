const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4().replace(/-/g, ''),
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
        isFloat: true,
      },
    },
    stock: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true,
      },
    },
    image: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        // Accept absolute URLs, relative paths (including /uploads/...), or data URIs
        isValidImagePath(value) {
          if (value === null || value === undefined || value === '') return;
          const str = String(value);
          const isAbsoluteUrl = /^https?:\/\//.test(str);
          const isDataUrl = /^data:image\/[a-zA-Z]+;base64,/.test(str);
          // relative path: starts with '/' or looks like 'folder/file.ext'
          const isRelativePath = str.startsWith('/') || /^[\w\-.\/]+$/.test(str);
          if (!isAbsoluteUrl && !isDataUrl && !isRelativePath) {
            throw new Error('Invalid image URL or path');
          }
        }
      },
      set(value) {
        // Normalize empty string to null to avoid validation errors
        if (value === '' || value === undefined) {
          this.setDataValue('image', null);
        } else {
          this.setDataValue('image', value);
        }
      }
    },
    categoryId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Category',
        key: 'id',
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    costPrice: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      validate: {
        min: 0,
        isFloat: true,
      },
    },
    productCode: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        len: [0, 50],
      },
    },
    color: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },
    size: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 20],
      },
    },
  }, {
    timestamps: true,
    tableName: 'Product',
    indexes: [
      {
        fields: ['categoryId'],
      },
      {
        fields: ['productCode'],
        unique: true,
      },
      {
        fields: ['isActive'],
      },
      {
        fields: ['name'],
      },
      {
        fields: ['price'],
      },
      {
        fields: ['stock'],
      },
    ],
    validate: {
      // Custom validation: cost price should not exceed selling price
      costPriceLessThanPrice() {
        if (this.costPrice > this.price) {
          throw new Error('Cost price cannot be greater than selling price');
        }
      },
    },
    hooks: {
      beforeCreate: (product, options) => {
        // Generate product code if not provided
        if (!product.productCode) {
          const timestamp = Date.now().toString().slice(-6);
          const random = Math.random().toString(36).substring(2, 5).toUpperCase();
          product.productCode = `PRD-${timestamp}-${random}`;
        }
      },
      beforeUpdate: (product, options) => {
        // Log stock changes
        if (product.changed('stock')) {
          console.log(`Stock updated for product ${product.id}: ${product._previousDataValues.stock} -> ${product.stock}`);
        }
      },
    },
  });

  Product.associate = (models) => {
    // Belongs to Category
    Product.belongsTo(models.Category, {
      foreignKey: 'categoryId',
      as: 'category',
    });

    // Has many TransactionItems
    Product.hasMany(models.TransactionItem, {
      foreignKey: 'productId',
      as: 'transactionItems',
    });

    // Many-to-Many with Promotions through ProductPromotion (if exists)
    if (models.Promotion && models.ProductPromotion) {
      Product.belongsToMany(models.Promotion, {
        through: models.ProductPromotion,
        foreignKey: 'productId',
        otherKey: 'promotionId',
        as: 'promotions',
      });
    }
  };

  // Instance methods
  Product.prototype.isInStock = function() {
    return this.stock > 0;
  };

  Product.prototype.canFulfillQuantity = function(quantity) {
    return this.stock >= quantity;
  };

  Product.prototype.updateStock = async function(quantity, operation = 'subtract') {
    if (operation === 'subtract') {
      if (this.stock < quantity) {
        throw new Error('Insufficient stock');
      }
      this.stock -= quantity;
    } else if (operation === 'add') {
      this.stock += quantity;
    }
    
    return await this.save();
  };

  Product.prototype.getProfit = function() {
    return this.price - this.costPrice;
  };

  Product.prototype.getProfitMargin = function() {
    if (this.price === 0) return 0;
    return ((this.price - this.costPrice) / this.price) * 100;
  };

  // Class methods
  Product.findByCategory = function(categoryId, options = {}) {
    return this.findAll({
      where: {
        categoryId,
        isActive: true,
        ...options.where,
      },
      ...options,
    });
  };

  Product.findLowStock = function(threshold = 10) {
    return this.findAll({
      where: {
        stock: {
          [sequelize.Sequelize.Op.lte]: threshold,
        },
        isActive: true,
      },
      include: [
        {
          model: sequelize.models.Category,
          as: 'category',
          attributes: ['name'],
        },
      ],
    });
  };

  Product.searchByName = function(searchTerm, options = {}) {
    return this.findAll({
      where: {
        name: {
          [sequelize.Sequelize.Op.iLike]: `%${searchTerm}%`,
        },
        isActive: true,
        ...options.where,
      },
      ...options,
    });
  };

  Product.getTopSelling = async function(limit = 10, startDate, endDate) {
    const { TransactionItem, Transaction } = sequelize.models;
    
    return await this.findAll({
      attributes: [
        'id',
        'name',
        'price',
        [sequelize.fn('SUM', sequelize.col('transactionItems.quantity')), 'totalSold'],
        [sequelize.fn('SUM', sequelize.col('transactionItems.subtotal')), 'totalRevenue'],
      ],
      include: [
        {
          model: TransactionItem,
          as: 'transactionItems',
          attributes: [],
          include: [
            {
              model: Transaction,
              as: 'transaction',
              attributes: [],
              where: startDate && endDate ? {
                createdAt: {
                  [sequelize.Sequelize.Op.between]: [startDate, endDate],
                },
                status: 'COMPLETED',
              } : {
                status: 'COMPLETED',
              },
            },
          ],
        },
      ],
      group: ['Product.id'],
      order: [[sequelize.literal('totalSold'), 'DESC']],
      limit,
      subQuery: false,
    });
  };

  // Scopes
  Product.addScope('active', {
    where: {
      isActive: true,
    },
  });

  Product.addScope('inStock', {
    where: {
      stock: {
        [sequelize.Sequelize.Op.gt]: 0,
      },
    },
  });

  Product.addScope('withCategory', {
    include: [
      {
        model: sequelize.models.Category,
        as: 'category',
      },
    ],
  });

  return Product;
};
