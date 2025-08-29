'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.changeColumn('appointments', 'chiefComplaints', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.changeColumn('appointments', 'investigation', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.changeColumn('appointments', 'diagnosis', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {

    await queryInterface.changeColumn('appointments', 'chiefComplaints', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn('appointments', 'investigation', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn('appointments', 'diagnosis', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
};
