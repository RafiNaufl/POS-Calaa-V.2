const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const CashierShiftLog = sequelize.define('CashierShiftLog', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4().replace(/-/g, ''),
    },
    cashierShiftId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'CashierShift',
        key: 'id',
      },
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [['OPEN_SHIFT', 'CLOSE_SHIFT', 'UPDATE_SHIFT']] },
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    timestamps: true,
    tableName: 'CashierShiftLog',
    indexes: [
      { fields: ['cashierShiftId'] },
      { fields: ['action'] },
      { fields: ['createdAt'] },
    ],
  });

  CashierShiftLog.associate = (models) => {
    if (models.CashierShift) {
      CashierShiftLog.belongsTo(models.CashierShift, {
        foreignKey: 'cashierShiftId',
        as: 'shift',
      });
    }
  };

  return CashierShiftLog;
};