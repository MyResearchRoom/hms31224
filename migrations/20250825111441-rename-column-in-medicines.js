'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn('medicines', 'name', 'medicinename');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameColumn('medicines', 'medicinename', 'name');
  }
};
