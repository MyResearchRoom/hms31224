'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('appointments', 'timeSlotStart', {
      type: Sequelize.TIME,
      allowNull: true,
    });
    await queryInterface.addColumn('appointments', 'timeSlotEnd', {
      type: Sequelize.TIME,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('appointments', 'timeSlotStart');
    await queryInterface.removeColumn('appointments', 'timeSlotEnd');
  }
};
