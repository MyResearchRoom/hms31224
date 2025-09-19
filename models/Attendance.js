"use strict";

module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define(
    "Attendance",
    {
      checkInTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      checkOutTime: {
        type: DataTypes.DATE,
        allowNull: true, // Can be null at the time of check-in
      },
      date: {
        type: DataTypes.DATEONLY, // Store the date separately for easy querying
        allowNull: false,
      },
    },
    {
      tableName: "attendances",
      timestamps: true,
      updatedAt: false, // Disable 'updatedAt' field since we don't need it here
    }
  );

  Attendance.associate = (models) => {
    // Each Attendance belongs to a doctor
    Attendance.belongsTo(models.Receptionist, {
      foreignKey: "receptionistId",
      as: "receptionist",
    });
  };

  return Attendance;
};
