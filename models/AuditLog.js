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
      role: {
        type: DataTypes.STRING(25),
        allowNull: false,
      },
      token: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      entity: {
        type: DataTypes.STRING(25),
        allowNull: true,
      },
      entityId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("success", "failure", "denied"),
        allowNull: false,
      },
      module: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      endpoint: {
        type: DataTypes.STRING,
        allowNull: false,
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
