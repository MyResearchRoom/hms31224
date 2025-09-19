'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    //doctor
    await queryInterface.addColumn('doctors', 'otp', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('doctors', 'otpExpiry', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    //receptionist
    await queryInterface.addColumn('receptionists', 'otp', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('receptionists', 'otpExpiry', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('doctors', 'otp');
    await queryInterface.removeColumn('doctors', 'otpExpiry');

    await queryInterface.removeColumn('receptionists', 'otp');
    await queryInterface.removeColumn('receptionists', 'otpExpiry');
  }
};
