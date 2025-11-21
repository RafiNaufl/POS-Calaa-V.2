const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const CashierShift = sequelize.define('CashierShift', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4().replace(/-/g, ''),
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    openingBalance: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: { min: 0 },
    },
    closingBalance: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: { min: 0 },
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'OPEN',
      validate: { isIn: [['OPEN', 'CLOSED']] },
    },
    systemTotal: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    physicalCash: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    difference: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    timestamps: true,
    tableName: 'CashierShift',
    indexes: [
      { fields: ['userId'] },
      { fields: ['status'] },
      { fields: ['startedAt'] },
      { fields: ['endedAt'] },
    ],
  });

  CashierShift.associate = (models) => {
    if (models.User) {
      CashierShift.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
    }
  };

  return CashierShift;
};