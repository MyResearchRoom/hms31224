const { Op, Sequelize } = require("sequelize");
const moment = require("moment-timezone");
const {
  Patient,
  Appointment,
  Doctor,
  SetFee,
  sequelize,
} = require("../models");
const { io } = require("../socket/socket");
const { decrypt } = require("../utils/cryptography");
const { update } = require("../websocket");

const generateUniquePatientId = async (name) => {
  const nameParts = name.split(" ");
  const initials = nameParts
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  let uniqueId;
  let isUnique = false;

  // Loop until a unique ID is generated
  while (!isUnique) {
    const randomDigits = Math.floor(10000 + Math.random() * 90000); // 5-digit random number
    uniqueId = `${initials}${randomDigits}`;

    // Check if this ID already exists in the database
    const existingDoctor = await Patient.findOne({
      where: { patientId: uniqueId },
    });

    // If the ID doesn't exist, it's unique
    if (!existingDoctor) {
      isUnique = true;
    }
  }

  return uniqueId;
};

const patientController = {
  async addPatient(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" }); // Unauthorized
    }

    const {
      name,
      mobileNumber,
      address,
      email,
      age,
      gender,
      reason,
      process,
      date,
      appointmentTime,
      dateOfBirth,
      bloodGroup,
      referredBy,
    } = req.body;

    const appointmentDate = new Date(date);

    if (appointmentDate < new Date().setHours(0, 0, 0, 0)) {
      return res
        .status(400)
        .json({ error: "Appointment date cannot be in the past" });
    }

    const transaction = await sequelize.transaction();

    try {
      // const doctor = await Doctor.findOne({
      //   where: { id: req.user.hospitalId },
      //   attributes: ["fees"],
      //   transaction, // Include the transaction
      // });

      const feeEntry = await SetFee.findOne({
        where: { doctorId: req.user.hospitalId, feesFor: reason },
        transaction,
      });

      const selectedFee = feeEntry ? feeEntry.fees : 0;

      const patientId = await generateUniquePatientId(name);

      const existingPatient = await Patient.findOne(
        { where: { name, mobileNumber } },
        { transaction }
      );

      if (existingPatient) {
        await transaction.rollback(); // Rollback the transaction if the patient already exists
        return res.status(400).json({ error: "Patient already exists" });
      }

      const patient = await Patient.create(
        {
          name,
          patientId,
          mobileNumber,
          address,
          email,
          age,
          gender,
          dateOfBirth,
          bloodGroup,
          referredBy,
          doctorId: req.user.hospitalId,
        },
        { transaction } // Include the transaction
      );

      const appointmentCount = await Appointment.findAll(
        {
          where: {
            date: {
              [Op.between]: [
                appointmentDate.setHours(0, 0, 0, 0),
                appointmentDate.setHours(23, 59, 59, 999),
              ],
            },
          },
          include: [
            {
              model: Patient,
              as: "patient",
              where: { doctorId: req.user.hospitalId },
            },
          ],
        },
        { transaction }
      );

      const appointment = await Appointment.create(
        {
          patientId: patient.id,
          appointmentNumber: appointmentCount.length + 1,
          reason,
          date,
          appointmentTime,
          process,
          fees: selectedFee,
          extraFees: 0,
        },
        { transaction } // Include the transaction
      );

      await transaction.commit(); // Commit the transaction if everything succeeds

      const appoDate = moment(appointment.date);

      if (appoDate.isSame(moment(), "day")) {
        update(
          {
            event: "newAppointment",
            appointment: {
              ...appointment.toJSON(),
              patient,
            },
          },
          req.user.hospitalId
        );
      }

      res.status(201).json({
        message: "Patient added successfully",
        appointment,
        patient,
      });
    } catch (error) {
      console.error(error);
      if (transaction) await transaction.rollback(); // Rollback the transaction in case of error
      res
        .status(500)
        .json({ error: "Failed to add patient", details: error.message });
    }
  },

  async bookAppointment(req, res) {
    const patientId = req.params.id;
    const { reason, date, process, appointmentTime } = req.body;

    const appointmentDate = new Date(date);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    if (appointmentDate < new Date().setHours(0, 0, 0, 0)) {
      return res
        .status(400)
        .json({ error: "Appointment date cannot be in the past" });
    }

    try {
      // const doctor = await Doctor.findOne({
      //   where: { id: req.user.hospitalId },
      //   attributes: ["fees"],
      // });

      const patient = await Patient.findOne({
        where: { id: patientId },
      });

      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const feeEntry = await SetFee.findOne({
        where: { doctorId: patient.doctorId, feesFor: reason },
      });

      const selectedFee = feeEntry ? feeEntry.fees : 0;

      const existingAppointment = await Appointment.findOne({
        where: {
          patientId,
          date: {
            [Op.between]: [
              startOfDay,
              endOfDay,
              // appointmentDate.setHours(0, 0, 0, 0),
              // appointmentDate.setHours(23, 59, 59, 999),
            ],
          },
        },
      });

      if (existingAppointment) {
        return res
          .status(400)
          .json({ error: "Patient already has an appointment on this date" });
      }

      const appointmentCount = await Appointment.findAll({
        where: {
          date: {
            [Op.between]: [
              appointmentDate.setHours(0, 0, 0, 0),
              appointmentDate.setHours(23, 59, 59, 999),
            ],
          },
        },
        include: [
          {
            model: Patient,
            as: "patient",
            where: { doctorId: req.user.hospitalId },
          },
        ],
      });

      const appointment = await Appointment.create({
        reason,
        date,
        process,
        appointmentTime,
        patientId,
        appointmentNumber: appointmentCount.length + 1,
        fees: selectedFee,
        extraFees: 0,
      });

      const appoDate = moment(appointment.date);

      if (appoDate.isSame(moment(), "day")) {
        update(
          {
            event: "newAppointment",
            appointment: {
              ...appointment.toJSON(),
              patient,
            },
          },
          req.user.hospitalId
        );
      }

      res.status(201).json({
        message: "Appointment booked successfully",
        appointment,
        patient,
      });
    } catch (error) {
      console.log(error);

      return res
        .status(500)
        .json({ error: "Failed to book appointment", details: error.message });
    }
  },

  // async getPatients(req, res) {
  //   if (!req.user) {
  //     return res.status(401).json({ error: "Unauthorized request" });
  //   }

  //   const { date, searchTerm } = req.query;

  //   const patientWhereClause = { doctorId: req.user.id };
  //   // if (searchTerm) {
  //   //   patientWhereClause[Op.or] = [
  //   //     { name: { [Op.like]: `%${searchTerm}%` } },
  //   //     { patientId: { [Op.like]: `%${searchTerm}%` } },
  //   //   ];
  //   // }

  //   try {
  //     let startOfDay = new Date(date);
  //     startOfDay.setHours(0, 0, 0, 0);

  //     let endOfDay = new Date(date);
  //     endOfDay.setHours(23, 59, 59, 999);

  //     const patients = await Patient.findAll({
  //       where: patientWhereClause,
  //       include: [
  //         {
  //           model: Appointment,
  //           as: "appointments",
  //           where: {
  //             date: {
  //               [Op.between]: [startOfDay, endOfDay],
  //             },
  //           },
  //           required: true,
  //           order: [["date", "DESC"]],
  //         },
  //       ],
  //     });

  //     const filteredPatients = patients.filter((patient) => {
  //       if (!searchTerm) return true;

  //       const nameMatch = decrypt(patient.name)
  //         ?.toLowerCase()
  //         .includes(searchTerm.toLowerCase());

  //       const idMatch = patient.patientId
  //         ?.toLowerCase()
  //         .includes(searchTerm.toLowerCase());

  //       return nameMatch || idMatch;
  //     });

  //     res.status(200).json({ patients: filteredPatients });
  //   } catch (error) {
  //     res.status(500).json({ error: "Failed to get patients" });
  //   }
  // },

  //new using moment

  async getPatients(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const { date, searchTerm, appointmentTime } = req.query;

    const patientWhereClause = { doctorId: req.user.hospitalId };

    try {
      const startOfDay = moment(date)
        .tz("Asia/Kolkata")
        .startOf("day")
        .toDate();
      const endOfDay = moment(date).tz("Asia/Kolkata").endOf("day").toDate();

      const appointmentWhereClause = {
        date: {
          [Op.between]: [startOfDay, endOfDay],
        },
      };

      if (appointmentTime) {
        appointmentWhereClause.appointmentTime = appointmentTime;
      }

      const patients = await Patient.findAll({
        where: patientWhereClause,
        include: [
          {
            model: Appointment,
            as: "appointments",
            where: appointmentWhereClause,
            required: true,
            attributes: {
              include: [
                [
                  Sequelize.literal(
                    "COALESCE(`appointments`.`fees`, 0) + COALESCE(`appointments`.`extraFees`, 0)"
                  ),
                  "fees",
                ],
              ],
            },
            order: [["date", "DESC"]],
          },
        ],
      });

      const filteredPatients = patients.filter((patient) => {
        if (!searchTerm) return true;

        const nameMatch = decrypt(patient.name)
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

        const idMatch = patient.patientId
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

        return nameMatch || idMatch;
      });

      res.status(200).json({ patients: filteredPatients });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get patients" });
    }
  },

  async getPatientsForAppointment(req, res) {
    const { searchTerm } = req.query;
    try {
      const patientWhereClause = { doctorId: req.user.hospitalId };
      // if (searchTerm) {
      //   patientWhereClause[Op.or] = [
      //     {
      //       name: {
      //         [Op.like]: `%${searchTerm}%`,
      //       },
      //     },
      //     {
      //       mobileNumber: {
      //         [Op.like]: `%${searchTerm}%`,
      //       },
      //     },
      //   ];
      // }

      const patients = await Patient.findAll({
        where: patientWhereClause,
        attributes: ["id", "name", "mobileNumber"],
      });

      const filteredPatients = patients.filter((patient) => {
        if (!searchTerm) return false;

        const nameMatch = decrypt(patient.name)
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

        const idMatch = patient.patientId
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

        return nameMatch || idMatch;
      });

      res.status(200).json({ patients: filteredPatients });
    } catch (error) {
      res.status(500).json({ error: "Failed to get patients" });
    }
  },

  async setToxicity(req, res) {
    if (!req.user || req.user.role !== "doctor") {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const { id } = req.params;

    try {
      const patient = await Patient.findByPk(id, {
        attributes: ["id", "toxicity"],
      });
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      patient.toxicity = !patient.toxicity;
      await patient.save();
      res
        .status(200)
        .json({ message: "Patient spacial category status updated" });
    } catch (error) {
      res.status(500).json({
        error: "Failed to update spacial category status",
        details: error.message,
      });
    }
  },

  // async getPatientsCount(req, res) {
  //   if (!req.user) {
  //     return res.status(401).json({ error: "Unauthorized request" });
  //   }

  //   const today = new Date();
  //   const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  //   const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  //   try {
  //     const todaysPatients = await Appointment.count({
  //       where: {
  //         date: {
  //           [Op.between]: [startOfDay, endOfDay],
  //         },
  //       },
  //     });
  //     const waitingPatients = await Appointment.count({
  //       where: {
  //         date: {
  //           [Op.between]: [startOfDay, endOfDay],
  //         },
  //         status: null,
  //       },
  //     });
  //     const completedPatients = await Appointment.count({
  //       where: {
  //         date: {
  //           [Op.between]: [startOfDay, endOfDay],
  //         },
  //         status: "out",
  //       },
  //     });

  //     return res.status(200).json({
  //       data: {
  //         todaysPatients,
  //         waitingPatients,
  //         completedPatients,
  //       },
  //     });
  //   } catch (error) {
  //     console.log(error);
  //     return res.status(500).json({
  //       error: "Failed to fetch patients count",
  //     });
  //   }
  // },

  async getPatientsCount(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const doctorId = req.user.hospitalId;

    // const today = new Date();
    // const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    // const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const startOfDay = moment().tz("Asia/Kolkata").startOf("day").toDate();
    const endOfDay = moment().tz("Asia/Kolkata").endOf("day").toDate();

    try {
      const todaysPatients = await Appointment.count({
        where: {
          date: {
            [Op.between]: [startOfDay, endOfDay],
          },
        },
        include: [
          {
            model: Patient,
            as: "patient",
            where: { doctorId },
          },
        ],
      });
      const waitingPatients = await Appointment.count({
        where: {
          date: {
            [Op.between]: [startOfDay, endOfDay],
          },
          status: null,
        },
        include: [
          {
            model: Patient,
            as: "patient",
            where: { doctorId },
          },
        ],
      });
      const completedPatients = await Appointment.count({
        where: {
          date: {
            [Op.between]: [startOfDay, endOfDay],
          },
          status: "out",
        },
        include: [
          {
            model: Patient,
            as: "patient",
            where: { doctorId },
          },
        ],
      });

      return res.status(200).json({
        data: {
          todaysPatients,
          waitingPatients,
          completedPatients,
        },
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        error: "Failed to fetch patients count",
      });
    }
  },
};

module.exports = patientController;
