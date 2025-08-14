"use strict";
const { encrypt, decrypt } = require("../utils/cryptography");

module.exports = (sequelize, DataTypes) => {
  const Doctor = sequelize.define("Doctor", {
    name: {
      type: DataTypes.STRING,
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
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dateOfBirth: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    age: {
      type: DataTypes.VIRTUAL,
      get() {
        if (this.dateOfBirth) {
          const today = new Date();
          const birthDate = new Date(this.dateOfBirth);
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
      },
    },
    gender: {
      type: DataTypes.ENUM("male", "female", "other"),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [8, 100], // Password must be at least 8 characters long
        is: /^(?=.*[a-zA-Z])(?=.*[0-9])/, // Password must contain at least one letter and one number
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
      type: DataTypes.STRING,
      allowNull: false,
    },
    registrationAuthority: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dateOfRegistration: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    medicalDegree: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    governmentId: {
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
      type: DataTypes.STRING,
      allowNull: true,
    },
    alternateContactNo: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // hidden
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
  },
    {
      tableName: "doctors",
    }
  );

  // Fields to encrypt
  const ENCRYPT_FIELDS = [
    "name",
    "mobileNumber",
    "address",
    "dateOfBirth",
    "medicalLicenceNumber",
    "governmentId",
    "specialization",
    "alternateContactNo",
    "signature",
    "logo",
    "profile",
  ];

  // Encrypt hook
  Doctor.addHook("beforeCreate", (doctor) => encryptFields(doctor));
  Doctor.addHook("beforeUpdate", (doctor) => encryptFields(doctor));

  function encryptFields(instance) {
    ENCRYPT_FIELDS.forEach((field) => {
      if (instance[field]) {
        instance[field] = encrypt(instance[field]);
      }
    });
  }

  // Decrypt when converting to JSON
  Doctor.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());

    ENCRYPT_FIELDS.forEach((field) => {
      if (values[field]) {
        if (field !== "profile" && field !== "signature") {
          values[field] = decrypt(values[field]);
        }
      }
    });

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
