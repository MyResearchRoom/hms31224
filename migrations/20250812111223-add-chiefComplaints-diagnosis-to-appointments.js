'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('appointments', 'chiefComplaints', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('appointments', 'diagnosis', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("appointments", "chiefComplaints");
    await queryInterface.removeColumn("appointments", "diagnosis");
  }
};
