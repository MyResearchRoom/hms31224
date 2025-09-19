"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("receptionist_documents", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      document: {
        type: Sequelize.BLOB("long"),
        allowNull: false,
      },
      contentType: {
        type: Sequelize.STRING,
        allowNull: false, // Can be null at the time of check-in
      },
      receptionistId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "receptionists", // Refers to the doctors table
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
    await queryInterface.dropTable("receptionist_documents");
  },
};
