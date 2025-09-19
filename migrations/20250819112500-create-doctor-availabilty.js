"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("doctor_availabilitys", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      doctorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "doctors",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      slotName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      slotStartTime: {
        type: Sequelize.TIME,
        allowNull: true,
      },
      slotEndTime: {
        type: Sequelize.TIME,
        allowNull: true,
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

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("doctor_availabilitys");
  },
};
