"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("doctors", "medicalLicenceNumber", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn("doctors", "registrationAuthority", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn("doctors", "dateOfRegistration", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn("doctors", "medicalDegree", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn("doctors", "governmentId", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("doctors", "medicalLicenceNumber");
    await queryInterface.removeColumn("doctors", "registrationAuthority");
    await queryInterface.removeColumn("doctors", "dateOfRegistration");
    await queryInterface.removeColumn("doctors", "medicalDegree");
    await queryInterface.removeColumn("doctors", "governmentId");
  },
};
