"use strict";

const {
  encrypt,
  decrypt,
  getDecryptedDocumentAsBase64,
} = require("../utils/cryptography");

module.exports = (sequelize, DataTypes) => {
  const Receptionist = sequelize.define(
    "Receptionist",
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      receptionistId: {
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
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      dateOfBirth: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      age: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      dateOfJoining: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      gender: {
        type: DataTypes.ENUM("male", "female", "other"),
        allowNull: false,
      },
      qualification: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: [8, 100],
          is: /^(?=.*[a-zA-Z])(?=.*[0-9])/,
        },
      },
      profile: {
        type: DataTypes.BLOB("long"),
        allowNull: true,
      },
      profileContentType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      otp: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      otpExpiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      shiftId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "shifts",
          key: "id",
        },
      },
    },
    {
      tableName: "receptionists",
    }
  );

  // Fields to encrypt
  const ENCRYPT_FIELDS = [
    "name",
    "mobileNumber",
    "address",
    "dateOfBirth",
    "profile",
  ];

  // Hook: Encrypt before create
  Receptionist.addHook("beforeCreate", (receptionist) =>
    encryptFields(receptionist)
  );
  // Hook: Encrypt before update
  Receptionist.addHook("beforeUpdate", (receptionist) =>
    encryptFields(receptionist)
  );

  // Utility to encrypt defined fields
  function encryptFields(instance) {
    ENCRYPT_FIELDS.forEach((field) => {
      if (instance[field]) {
        instance[field] = encrypt(instance[field]);
      }
    });
  }

  // Hook: Decrypt when converting to JSON
  Receptionist.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());

    ENCRYPT_FIELDS.forEach((field) => {
      if (values[field]) {
        if (field !== "profile") {
          values[field] = decrypt(values[field]);
        }
      }
    });

    delete values.password;
    return values;
  };

  Receptionist.associate = (models) => {
    Receptionist.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });

    Receptionist.belongsTo(models.Shift, {
      foreignKey: "shiftId",
      as: "shift",
    });

    Receptionist.hasMany(models.Attendance, {
      foreignKey: "receptionistId",
      as: "attendances",
    });

    Receptionist.hasMany(models.ReceptionistDocument, {
      foreignKey: "receptionistId",
      as: "documents",
    });
  };

  return Receptionist;
};
