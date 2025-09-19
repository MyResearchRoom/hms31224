"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("doctors", "name", {
      type: Sequelize.TEXT,
      allowNull: false,
    });
    await queryInterface.changeColumn("doctors", "mobileNumber", {
      type: Sequelize.TEXT,
      allowNull: false,
    });
    await queryInterface.changeColumn("doctors", "address", {
      type: Sequelize.TEXT,
      allowNull: false,
    });
    await queryInterface.changeColumn("doctors", "dateOfBirth", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.changeColumn("doctors", "medicalLicenceNumber", {
      type: Sequelize.TEXT,
      allowNull: false,
    });
    await queryInterface.changeColumn("doctors", "specialization", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.changeColumn("doctors", "alternateContactNo", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {},
};
