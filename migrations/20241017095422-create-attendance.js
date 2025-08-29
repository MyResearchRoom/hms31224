"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("attendances", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      checkInTime: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      checkOutTime: {
        type: Sequelize.DATE,
        allowNull: true, // Can be null at the time of check-in
      },
      date: {
        type: Sequelize.DATEONLY, // Store the date separately for easy querying
        allowNull: false,
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
    }); 
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("attendances");
  },
};
