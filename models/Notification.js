const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {}

  Notification.init(
    {
      doctorId: {   
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      message: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Notification",
      tableName: "notifications",
      timestamps: true,
    }
  );

  return Notification;
};
