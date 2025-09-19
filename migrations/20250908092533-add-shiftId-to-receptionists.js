"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("receptionists", "shiftId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "shifts",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL", 
    });

    await queryInterface.removeColumn("receptionists", "allotedShift");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("receptionists", "allotedShift", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.removeColumn("receptionists", "shiftId");
  },
};
