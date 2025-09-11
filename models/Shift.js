"use strict";

module.exports = (sequelize, DataTypes) => {
  const Shift = sequelize.define(
    "Shift",
    {
      shiftName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      shiftStartTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      shiftEndTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
    },
    {
      tableName: "shifts",
    }
  );

  Shift.associate = (models) => {
    // Each SetFees belongs to a doctor
    Shift.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });
    Shift.hasMany(models.Receptionist, {
      foreignKey: "shiftId",
      as: "receptionists",
    });
  };

  return Shift;
};
