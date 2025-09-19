"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("appointments", "note", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("appointments", "prescription", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn("appointments", "followUp", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("appointments", "note");
    await queryInterface.removeColumn("appointments", "prescription");
    await queryInterface.removeColumn("appointments", "followUp");
  },
};
