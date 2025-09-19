"use strict";
const { encrypt, decrypt } = require("../utils/cryptography");
function getAge(dateOfBirth) {
  if (dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  }
  return null;
}
module.exports = (sequelize, DataTypes) => {
  const Doctor = sequelize.define(
    "Doctor",
    {
      name: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      clinicName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      doctorId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      mobileNumber: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      dateOfBirth: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      clinicStartTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      clinicEndTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      openDays: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      closedDays: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      clinicAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      experience: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      gender: {
        type: DataTypes.ENUM("male", "female", "other"),
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      profile: {
        type: DataTypes.BLOB("long"),
        allowNull: true,
      },
      profileContentType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      signature: {
        type: DataTypes.BLOB("long"),
        allowNull: true,
      },
      signatureContentType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      logo: {
        type: DataTypes.BLOB("long"),
        allowNull: true,
      },
      logoContentType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      medicalLicenceNumber: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      medicalDegree: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      paymentQr: {
        type: DataTypes.BLOB("long"),
        allowNull: true,
      },
      qrContentType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      patientRegQr: {
        type: DataTypes.BLOB("long"),
        allowNull: true,
      },
      regQrType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      specialization: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      alternateContactNo: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      fees: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      acceptedTAndC: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      verificationToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      checkInTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      checkOutTime: {
        type: DataTypes.TIME,
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
      mapping: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "doctors",
    }
  );

  const ENCRYPT_FIELDS = [
    "name",
    "mobileNumber",
    "address",
    "dateOfBirth",
    "medicalLicenceNumber",
    "specialization",
    "alternateContactNo",
    "signature",
    "logo",
    "profile",
  ];

  Doctor.addHook("beforeCreate", (doctor) => encryptFields(doctor));
  Doctor.addHook("beforeUpdate", (doctor) => encryptFields(doctor));

  function encryptFields(instance) {
    ENCRYPT_FIELDS.forEach((field) => {
      if (instance[field]) {
        instance[field] = encrypt(instance[field]);
      }
    });
  }

  Doctor.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());

    ENCRYPT_FIELDS.forEach((field) => {
      if (values[field]) {
        if (field !== "profile" && field !== "signature" && field !== "logo") {
          values[field] = decrypt(values[field]);
        }
        if (field === "dateOfBirth")
          values["age"] = getAge(values["dateOfBirth"]);
      }
    });

    values["closedDays"] =
      typeof values["closedDays"] === "string"
        ? JSON.parse(values["closedDays"])
        : values["closedDays"];

    delete values.password;
    return values;
  };

  Doctor.associate = (models) => {
    Doctor.hasMany(models.Receptionist, {
      foreignKey: "doctorId",
      as: "receptionists",
    });
  };

  return Doctor;
};
