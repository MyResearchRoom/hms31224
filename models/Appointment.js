"use strict";

const { encrypt, decrypt } = require("../utils/cryptography");

module.exports = (sequelize, DataTypes) => {
  const Appointment = sequelize.define(
    "Appointment",
    {
      appointmentNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      date: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      process: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fees: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      extraFees: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("in", "out", "cancel"),
        allowNull: true,
      },
      paymentStatus: {
        type: DataTypes.ENUM("pending", "completed", "cancelled"),
        defaultValue: "pending",
      },
      document: {
        type: DataTypes.BLOB("long"),
        allowNull: true,
      },
      documentType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      paymentMode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      parameters: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      chiefComplaints: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      investigation: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      diagnosis: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      prescription: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      followUp: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      appointmentTime: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },

    {
      tableName: "appointments",
    }
  );

  const ENCRYPT_FIELDS = [
    "reason",
    "parameters",
    "note",
    "investigation",
    "prescription",
    "followUp",
    "document",
    "chiefComplaints",
    "diagnosis",
  ];

  // Encrypt hook
  Appointment.addHook("beforeCreate", (appointment) =>
    encryptFields(appointment)
  );
  Appointment.addHook("beforeUpdate", (appointment) =>
    encryptFields(appointment)
  );

  function encryptFields(instance) {
    ENCRYPT_FIELDS.forEach((field) => {
      if (instance[field]) {
        instance[field] = encrypt(
          typeof instance[field] === "string"
            ? instance[field]
            : JSON.stringify(instance[field])
        );
      }
    });
  }

  Appointment.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());

    ENCRYPT_FIELDS.forEach((field) => {
      if (values[field]) {
        values[field] = decrypt(
          [
            "prescription",
            "parameters",
            "chiefComplaints",
            "investigation",
            "diagnosis",
          ].includes(field)
            ? values[field].substring(1, values[field].length - 1)
            : values[field]
        );
        if (
          [
            "prescription",
            "parameters",
            "chiefComplaints",
            "investigation",
            "diagnosis",
          ].includes(field)
        ) {
          values[field] = JSON.parse(values[field]);
        }
      }
    });

    delete values.password;
    return values;
  };

  Appointment.associate = (models) => {
    Appointment.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });
  };

  return Appointment;
};
