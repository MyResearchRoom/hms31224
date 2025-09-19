"use strict";

module.exports = (sequelize, DataTypes) => {
    const DoctorAvailability = sequelize.define("DoctorAvailability",
        {
            slotName: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            slotStartTime: {
                type: DataTypes.TIME,
                allowNull: true,
            },
            slotEndTime: {
                type: DataTypes.TIME,
                allowNull: true,
            },
        },
        {
            tableName: "doctor_availabilitys",
        }
    );

    DoctorAvailability.associate = (models) => {
        // Each SetFees belongs to a doctor
        DoctorAvailability.belongsTo(models.Doctor, {
            foreignKey: "doctorId",
            as: "doctor",
        });
    };

    return DoctorAvailability;
};
