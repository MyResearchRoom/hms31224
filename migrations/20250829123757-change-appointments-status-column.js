"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("appointments", "status", {
      type: Sequelize.ENUM("in", "out", "cancel"),
      allowNull: true,
    });
    await queryInterface.addColumn("appointments", "isRescheduled", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("appointments", "status", {
      type: Sequelize.ENUM("in", "out"),
      allowNull: true,
    });
    await queryInterface.removeColumn("appointments", "isRescheduled");
  },
};
