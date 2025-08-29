"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("appointments", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      reason: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      process: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      fees: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("in", "out"),
        allowNull: true,
      },
      paymentStatus: {
        type: Sequelize.ENUM("pending", "completed", "cancelled"),
        defaultValue: "pending",
      },
      paymentMode: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      parameters: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      document: {
        type: Sequelize.BLOB("long"),
        allowNull: true,
      },
      documentType: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      patientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "patients", // Refers to the doctors table
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
    await queryInterface.dropTable("appointments");
  },
};
