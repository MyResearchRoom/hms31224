"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("doctors", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      doctorId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      mobileNumber: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          is: /^[0-9]+$/, // Only numbers allowed
          len: [10, 15], // Mobile number should be between 10-15 digits
        },
      },
      address: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true, // Ensure valid email
        },
      },
      dateOfBirth: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      gender: {
        type: Sequelize.ENUM("male", "female", "other"),
        allowNull: false,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          len: [8, 100], // At least 8 characters
          is: /^(?=.*[a-zA-Z])(?=.*[0-9])/, // Must contain at least one letter and one number
        },
      },
      profile: {
        type: Sequelize.BLOB("long"),
        allowNull: true,
      },
      profileContentType: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      signature: {
        type: Sequelize.BLOB("long"),
        allowNull: true,
      },
      signatureContentType: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("doctors");
  },
};
