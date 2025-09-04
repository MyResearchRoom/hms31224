"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("patients", "bloodGroup", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn("patients", "dateOfBirth", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("patients", "bloodGroup");
    await queryInterface.removeColumn("patients", "dateOfBirth");
  },
};
