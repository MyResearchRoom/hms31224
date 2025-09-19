'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('doctors', 'specialization', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('doctors', 'alternateContactNo', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn('doctors', 'specialization');
    await queryInterface.removeColumn('doctors', 'alternateContactNo');
  }
};
