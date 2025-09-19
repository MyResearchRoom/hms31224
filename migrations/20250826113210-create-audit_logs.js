"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("audit_logs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT,
      },
      hospitalId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "doctors",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      doctorId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "doctors",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      receptionistId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "receptionists",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      action: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      details: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      oldValue: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      newValue: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      ipAddress: {
        type: Sequelize.STRING,
      },
      userAgent: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("audit_logs");
  },
};
