'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('doctors', 'logo', {
      type: Sequelize.BLOB('long'),
      allowNull: true,
    });
    await queryInterface.addColumn('doctors', 'logoContentType', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn('doctors', 'logo');
    await queryInterface.removeColumn('doctors', 'logoContentType');
  }
};
