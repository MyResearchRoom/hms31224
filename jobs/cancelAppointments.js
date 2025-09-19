const { Op } = require("sequelize");
const { Appointment } = require("../models");
const cron = require("node-cron");
const moment = require("moment-timezone");

const cancelAppointments = async () => {
  const date = moment().tz("Asia/Kolkata").subtract(1, "day").toDate();

  try {
    await Appointment.update(
      {
        status: "cancel",
      },
      {
        where: {
          date: {
            [Op.lt]: date,
          },
          status: null,
        },
      }
    );

    console.log("Appointments cancel successfully");
  } catch (error) {
    console.log("Error while performing cancel appointment event:", error);
  }
};

module.exports = () => {
  cron.schedule("0 0 * * *", cancelAppointments, {
    timezone: "Asia/Kolkata",
  });
};
