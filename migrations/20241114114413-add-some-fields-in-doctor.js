"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("doctors", "verified", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn("doctors", "verificationToken", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("doctors", "checkInTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });
    await queryInterface.addColumn("doctors", "checkOutTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("doctors", "verified");
    await queryInterface.removeColumn("doctors", "verificationToken");
    await queryInterface.removeColumn("doctors", "checkInTime");
    await queryInterface.removeColumn("doctors", "checkOutTime");
  },
};
