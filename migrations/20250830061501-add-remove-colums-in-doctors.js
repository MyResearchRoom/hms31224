"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn("doctors", "dateOfRegistration");
    await queryInterface.removeColumn("doctors", "registrationAuthority");
    await queryInterface.removeColumn("doctors", "governmentId");
    await queryInterface.addColumn("doctors", "clinicAddress", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn("doctors", "experience", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("doctors", "dateOfRegistration", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn("doctors", "registrationAuthority", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn("doctors", "governmentId", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.removeColumn("doctors", "clinicAddress");
    await queryInterface.removeColumn("doctors", "experience");
  },
};
