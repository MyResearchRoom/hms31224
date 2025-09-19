'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('receptionists', 'allotedShift', {
      type: Sequelize.STRING,
      allowedNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('receptionists', 'allotedShift');
  }
};
