'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('doctors', 'openDays', {
      type: Sequelize.JSON,
      allowNull: true
    });
    await queryInterface.addColumn('doctors', 'closedDays', {
      type: Sequelize.JSON,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('doctors', 'openDays');
    await queryInterface.removeColumn('doctors', 'closedDays');
  }
};
