"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("shifts", {
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
      shiftName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      shiftStartTime: {
        type: Sequelize.TIME,
        allowNull: true,
      },
      shiftEndTime: {
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
    await queryInterface.dropTable("shifts");
  },
};
