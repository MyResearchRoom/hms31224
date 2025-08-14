"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("doctors", "clinicName", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn("doctors", "paymentQr", {
      type: Sequelize.BLOB("long"),
      allowNull: true,
    });
    await queryInterface.addColumn("doctors", "qrContentType", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("doctors", "patientRegQr", {
      type: Sequelize.BLOB("long"),
      allowNull: true,
    });
    await queryInterface.addColumn("doctors", "regQrType", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("doctors", "acceptedTAndC", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("doctors", "clinicName");
    await queryInterface.removeColumn("doctors", "paymentQr");
    await queryInterface.removeColumn("doctors", "qrContentType");
    await queryInterface.removeColumn("doctors", "patientRegQr");
    await queryInterface.removeColumn("doctors", "regQrType");
    await queryInterface.removeColumn("doctors", "acceptedTAndC");
  },
};
