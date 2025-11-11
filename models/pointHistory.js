module.exports = (sequelize, DataTypes) => {
  const PointHistory = sequelize.define('PointHistory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    memberId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Members',
        key: 'id'
      }
    },
    transactionId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'Transactions',
        key: 'id'
      }
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('EARNED', 'USED', 'EXPIRED', 'ADJUSTED'),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
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
    tableName: 'PointHistories',
    timestamps: true
  });

  PointHistory.associate = (models) => {
    // Belongs to Member
    PointHistory.belongsTo(models.Member, {
      foreignKey: 'memberId',
      as: 'member'
    });

    // Belongs to Transaction (optional)
    PointHistory.belongsTo(models.Transaction, {
      foreignKey: 'transactionId',
      as: 'transaction'
    });
  };

  return PointHistory;
};