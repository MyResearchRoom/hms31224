"use strict";

module.exports = (sequelize, DataTypes) => {
  const Medicine = sequelize.define("Medicine", {
    medicinename: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    strength: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    form: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    brand: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
   {
    tableName: "medicines",
  }
);

  Medicine.associate = (models) => {
    // Each Medicine belongs to a doctor
    Medicine.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });
  };

  return Medicine;
};
