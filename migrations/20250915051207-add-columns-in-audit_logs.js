"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("audit_logs", "role", {
      type: Sequelize.STRING(25),
      allowNull: false,
    });
    await queryInterface.addColumn("audit_logs", "token", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("audit_logs", "entity", {
      type: Sequelize.STRING(25),
      allowNull: false,
    });
    await queryInterface.addColumn("audit_logs", "entityId", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn("audit_logs", "status", {
      type: Sequelize.ENUM("success", "failure", "denied"),
      allowNull: false,
    });
    await queryInterface.addColumn("audit_logs", "module", {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
    await queryInterface.addColumn("audit_logs", "endpoint", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("audit_logs", "role");
    await queryInterface.removeColumn("audit_logs", "token");
    await queryInterface.removeColumn("audit_logs", "entity");
    await queryInterface.removeColumn("audit_logs", "entityId");
    await queryInterface.removeColumn("audit_logs", "status");
    await queryInterface.removeColumn("audit_logs", "module");
    await queryInterface.removeColumn("audit_logs", "endpoint");
  },
};
