"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("receptionists", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      receptionistId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      mobileNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      address: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      age: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      dateOfJoining: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      gender: {
        type: Sequelize.ENUM("male", "female", "other"),
        allowNull: false,
      },
      qualification: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      profile: {
        type: Sequelize.BLOB("long"),
        allowNull: true,
      },
      profileContentType: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      doctorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "doctors", // Refers to the doctors table
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("receptionists");
  },
};
