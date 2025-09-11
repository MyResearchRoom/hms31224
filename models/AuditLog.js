const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AuditLog extends Model {
    static associate(models) {
      AuditLog.belongsTo(models.Doctor, {
        foreignKey: "doctorId",
        as: "doctor",
      });
      AuditLog.belongsTo(models.Receptionist, {
        foreignKey: "receptionistId",
        as: "receptionist",
      });
    }
  }

  AuditLog.init(
    {
      hospitalId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      doctorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      receptionistId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      oldValue: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      newValue: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      ipAddress: {
        type: DataTypes.STRING,
      },
      userAgent: {
        type: DataTypes.STRING,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "AuditLog",
      tableName: "audit_logs",
      timestamps: false,
    }
  );

  return AuditLog;
};
