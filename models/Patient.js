"use strict";

const { encrypt, decrypt } = require("../utils/cryptography");

module.exports = (sequelize, DataTypes) => {
  const Patient = sequelize.define(
    "Patient",
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      nameSearch: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      mobileSearch: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      patientId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      mobileNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      age: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      dateOfBirth: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      bloodGroup: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      gender: {
        type: DataTypes.ENUM("male", "female", "other"),
        allowNull: false,
      },
      toxicity: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      referredBy: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "patients",
    }
  );

  const ENCRYPT_FIELDS = [
    "name",
    "email",
    "mobileNumber",
    "address",
    "dateOfBirth",
    "referredBy",
  ];

  Patient.addHook("beforeCreate", (patient) => encryptFields(patient));
  Patient.addHook("beforeUpdate", (patient) => encryptFields(patient));

  function encryptFields(instance) {
    ENCRYPT_FIELDS.forEach((field) => {
      if (instance[field]) {
        instance[field] = encrypt(instance[field]);
      }
    });
  }

  Patient.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());

    ENCRYPT_FIELDS.forEach((field) => {
      if (values[field]) {
        values[field] = decrypt(values[field]);
      }
    });

    delete values.password;
    return values;
  };

  Patient.associate = (models) => {
    Patient.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });

    Patient.hasMany(models.Appointment, {
      foreignKey: "patientId",
      as: "appointments",
    });
  };

  return Patient;
};
