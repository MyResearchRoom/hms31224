'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn("doctors", "clinicStartTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });
    await queryInterface.addColumn("doctors", "clinicEndTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn("doctors", "clinicStartTime");
    await queryInterface.removeColumn("doctors", "clinicEndTime");
  }
};
