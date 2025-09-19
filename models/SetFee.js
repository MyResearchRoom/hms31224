"use strict";

module.exports = (sequelize, DataTypes) => {
    const SetFee = sequelize.define("SetFee",
        {
            feesFor: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            fees: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
            },
        },
        {
            tableName: "set_fees",
        }
    );

    SetFee.associate = (models) => {
        // Each SetFees belongs to a doctor
        SetFee.belongsTo(models.Doctor, {
            foreignKey: "doctorId",
            as: "doctor",
        });
    };

    return SetFee;
};
