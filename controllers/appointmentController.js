const { Op } = require("sequelize");
const moment = require("moment-timezone");

const { Patient, Appointment, AuditLog, sequelize } = require("../models");
const {
  getDecryptedDocumentAsBase64,
  decrypt,
} = require("../utils/cryptography");
const { update } = require("../websocket");

const patientController = {
  async addParameters(req, res) {
    const appointmentId = req.params.id;
    const { parameters } = req.body;

    const transaction = await sequelize.transaction();
    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        attributes: ["id", "parameters", "status"],
        transaction,
      });
      if (!appointment) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Appointment not found" });
      }
      if (appointment.status === "cancel") {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Can't add parameters, Appointment is cancelled." });
      }

      if (appointment.date > new Date()) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Cannot add parameters to future appointments" });
      }

      const oldParameters = appointment.parameters;
      appointment.parameters = parameters;

      await appointment.save({ transaction });

      await AuditLog.create(
        {
          action: `${oldParameters ? "Change" : "Add"} Parameters`,
          details: `${
            oldParameters ? "Changed" : "Added"
          } parameters to appointment ID ${appointmentId}`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      update(
        {
          event: "parametersUpdated",
          appointmentId,
          parameters,
        },
        req.user.hospitalId
      );

      res.status(200).json({ message: "Parameters added successfully" });
    } catch (error) {
      if (transaction) await transaction.commit();
      res.status(500).json({ error: "Failed to add parameters" });
    }
  },

  async addPaymentMode(req, res) {
    const appointmentId = req.params.id;
    const { paymentMode } = req.body;

    if (paymentMode !== "Cash" && paymentMode !== "Online") {
      return res.status(400).json({ error: "Invalid payment mode" });
    }

    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        attributes: ["id", "paymentMode", "status"],
      });
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      if (appointment.status === "cancel") {
        return res
          .status(400)
          .json({ error: "Can't add payment mode, Appointment is cancelled." });
      }

      if (appointment.date > new Date()) {
        return res
          .status(400)
          .json({ error: "Cannot add payment mode to future appointments" });
      }
      appointment.paymentMode = paymentMode;

      await appointment.save();

      res.status(200).json({ message: "Payment mode updated successfully" });
    } catch (error) {
      res.status(500).json({
        error: "Failed to update payment mode",
      });
    }
  },

  async addPrescription(req, res) {
    const appointmentId = req.params.id;

    if (!req.file && !req.body.base64Image) {
      return res.status(400).json({ error: "No file or image data uploaded" });
    }

    const transaction = await sequelize.transaction();
    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        attributes: ["id", "document", "status"],
        transaction,
      });
      if (!appointment) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Appointment not found" });
      }
      if (appointment.status === "cancel") {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Can't add prescription, Appointment is cancelled." });
      }

      if (appointment.date > new Date()) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Cannot add prescription for future appointments" });
      }

      let fileData;

      if (req.file) {
        fileData = `data:${req.file.mimetype};base64,${req.file.buffer.toString(
          "base64"
        )}`;
      } else if (req.body.base64Image) {
        const base64Image = req.body.base64Image;
        const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          return res.status(400).json({ error: "Invalid base64 image format" });
        }
        fileData = base64Image;
      }

      const oldPrescription = appointment.document;
      appointment.document = fileData;

      await appointment.save({ transaction });

      await AuditLog.create(
        {
          action: `${oldPrescription ? "Change" : "Add"} prescription`,
          details: `${
            oldPrescription ? "Changed" : "Added"
          } prescription to appointment ID ${appointmentId}`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      res.status(200).json({
        message: "Prescription added successfully",
        document: fileData,
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      res.status(500).json({
        error: "Failed to add prescription",
      });
    }
  },

  async submitPrescription(req, res) {
    const { prescription } = req.body;
    const appointmentId = req.params.id;

    const transaction = await sequelize.transaction();
    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        attributes: ["id", "prescription", "status"],
        transaction,
      });
      if (!appointment) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Appointment not found" });
      }
      if (appointment.status === "cancel") {
        if (transaction) await transaction.rollback();
        return res.status(400).json({
          error: "Can't submit prescription, Appointment is cancelled.",
        });
      }

      if (!Array.isArray(prescription)) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ error: "Prescription must be an array" });
      }

      if (appointment.date > new Date()) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({
          error: "Cannot submit prescription for future appointments",
        });
      }

      const oldPrescription = appointment.prescription;
      appointment.prescription = prescription;

      await appointment.save({ transaction });

      await AuditLog.create(
        {
          action: "Submit prescription",
          details: `Submitted prescription to appointment ID ${appointmentId}`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          oldValue: oldPrescription,
          newValue: prescription,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      res.status(200).json({ message: "Prescription submitted successfully" });
    } catch (error) {
      if (transaction) await transaction.rollback();
      res.status(500).json({
        error: "Failed to submit prescription",
      });
    }
  },

  async submitAppointment(req, res) {
    const {
      followUp,
      note,
      fees,
      extraFees,
      investigation,
      chiefComplaints,
      diagnosis,
      prescription,
    } = req.body;

    if (fees) {
      const parsedFees = parseFloat(fees);
      if (Number.isNaN(parsedFees) || parsedFees <= 0) {
        return res
          .status(400)
          .json({ error: "Fees must be a valid number greater than 0" });
      }
    }

    if (extraFees) {
      const parsedExtraFees = parseFloat(extraFees);
      if (Number.isNaN(parsedExtraFees) || parsedExtraFees < 0) {
        return res.status(400).json({
          error: "Extra fees must be a valid number (>= 0)",
        });
      }
    }

    const followUpDate = new Date(followUp).setHours(0, 0, 0, 0);

    if (followUpDate <= new Date().setHours(0, 0, 0, 0)) {
      return res
        .status(400)
        .json({ error: "Follow-up date cannot be in the past" });
    }

    const appointmentId = req.params.id;

    const transaction = await sequelize.transaction();
    try {
      const appointment = await Appointment.findByPk(
        appointmentId,
        {
          attributes: [
            "id",
            "followUp",
            "note",
            "fees",
            "extraFees",
            "investigation",
            "chiefComplaints",
            "diagnosis",
            "status",
          ],
        },
        {
          transaction,
        }
      );
      if (!appointment) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Appointment not found" });
      }

      if (appointment.status === "cancel") {
        if (transaction) await transaction.rollback();
        return res.status(400).json({
          error: "Can't submit appointment, Appointment is cancelled.",
        });
      }

      if (appointment.date > new Date()) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Cannot submit future appointments" });
      }

      const oldValue = {
        ...appointment.toJSON(),
      };
      const status = appointment.status;

      appointment.note = note || null;
      appointment.followUp = followUp || null;
      appointment.investigation = investigation ? investigation : null;
      appointment.chiefComplaints = chiefComplaints ? chiefComplaints : null;
      appointment.diagnosis = diagnosis ? diagnosis : null;
      if (fees && appointment.status !== "out") {
        appointment.fees = appointment.fees + parseInt(fees, 10);
      }
      appointment.extraFees = parseInt(extraFees, 10);
      appointment.prescription = Array.isArray(prescription)
        ? prescription
        : null;

      appointment.status = "out";

      await appointment.save({ transaction });

      await AuditLog.create(
        {
          action: `${
            status === null || status === "in" ? "Submit" : "Re-submit"
          } appointment`,
          details: `${
            status === null || status === "in" ? "Submitted" : "Re-submitted"
          } appointment to appointment ID ${appointmentId}`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      update(
        {
          event: "updatedAppointment",
          appointment: {
            appointmentId: appointment.id,
            fees: appointment.fees,
            extraFees: appointment.extraFees,
            followUp: appointment.followUp,
            note: appointment.note,
            prescription: appointment.prescription,
          },
        },
        req.user.hospitalId
      );

      res.status(200).json({ message: "Prescription submitted successfully" });
    } catch (error) {
      if (transaction) await transaction.rollback();
      res.status(500).json({
        error: "Failed to add prescription",
      });
    }
  },

  async getTodaysAppointments(req, res) {
    const { searchTerm, date, appointmentTime } = req.query;

    try {
      const patientWhere = {
        doctorId: req.user.hospitalId,
      };

      const appointmentWhere = {
        date: {
          [Op.between]: [
            moment(date).tz("Asia/Kolkata").startOf("day").toDate(),
            moment(date).tz("Asia/Kolkata").endOf("day").toDate(),
          ],
        },
      };

      if (appointmentTime) {
        appointmentWhere.appointmentTime = appointmentTime;
      }

      const appointments = await Appointment.findAll({
        where: appointmentWhere,
        include: [
          {
            model: Patient,
            where: patientWhere,
            as: "patient",
          },
        ],
        order: [
          [
            sequelize.literal(
              `CASE WHEN status IS NULL THEN 1 WHEN status = 'out' THEN 2 ELSE 0 END`
            ),
            "ASC",
          ],
          ["appointmentTime", "ASC"],
          ["createdAt", "ASC"],
        ],
      });

      const filteredAppointments = appointments.filter((appointment) => {
        if (!searchTerm) return true;

        const nameMatch = decrypt(appointment.patient?.name)
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

        const idMatch = appointment.patient?.patientId
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

        return nameMatch || idMatch;
      });

      const data = filteredAppointments.map((appointment) => ({
        ...appointment.toJSON(),
        document: appointment.document
          ? getDecryptedDocumentAsBase64(appointment.document)
          : null,
      }));

      const includeOption = [
        {
          model: Patient,
          as: "patient",
        },
      ];
      const whereClause = {
        "$patient.doctorId$": req.user.hospitalId,
        date: {
          [Op.between]: [
            moment(date).tz("Asia/Kolkata").startOf("day").toDate(),
            moment(date).tz("Asia/Kolkata").endOf("day").toDate(),
          ],
        },
      };
      const [pendingCnt, completeCnt] = await Promise.all([
        Appointment.count({
          where: {
            ...whereClause,
            status: null,
          },
          include: includeOption,
        }),
        Appointment.count({
          where: {
            ...whereClause,
            status: "out",
          },
          include: includeOption,
        }),
      ]);

      res.status(200).json({
        appointments: data,
        stats: { pendingCnt, completeCnt },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get appointments" });
    }
  },

  async getPatientAppointments(req, res) {
    const patientId = req.params.id;

    try {
      const appointments = await Patient.findOne({
        where: { id: patientId },
        include: [
          {
            model: Appointment,
            as: "appointments",
          },
        ],
      });

      if (!appointments) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const data = appointments.appointments.map((appointment) => ({
        ...appointment.toJSON(),
        document: getDecryptedDocumentAsBase64(appointment.document),
      }));

      res.status(200).json({
        appointments: {
          ...appointments.toJSON(),
          appointments: data,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get appointments" });
    }
  },

  async setAppointmentStatus(req, res) {
    const appointmentId = req.params.id;
    const { status } = req.body;

    if (!["in", "out"].includes(status)) {
      return res.status(400).json({ error: "Invalid status provided." });
    }

    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        attributes: ["id", "status"],
        include: [{ model: Patient, as: "patient" }],
      });

      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found." });
      }
      if (appointment.status === "cancel") {
        return res
          .status(400)
          .json({ error: "Can't change status, Appointment is cancelled." });
      }

      if (appointment.status === null && status === "out") {
        return res.status(400).json({
          error: "Cannot set status to out if it's not set to in first.",
        });
      }

      if (appointment.status === "out") {
        return res.status(400).json({ error: "Appointment is already out." });
      }

      await Appointment.update({ status: "out" }, { where: { status: "in" } });

      appointment.status = status;
      await appointment.save();

      update(
        {
          event: "appointmentUpdated",
          ...(status === "in"
            ? { appointment, hospitalId: req.user.hospitalId }
            : {}),
        },
        req.user.hospitalId
      );

      return res.status(200).json({
        message: `Appointment status updated to ${status}.`,
        appointment,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to update appointment status",
      });
    }
  },

  async getFirstAppointment(req, res) {
    try {
      const doctorId = req.user.hospitalId;
      const options = req.user.role === "doctor" ? ["in"] : ["in", null];

      let appointment;
      const date = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");

      appointment = await Appointment.findOne({
        where: {
          date,
          status: {
            [Op.or]: options,
          },
        },
        include: [
          {
            model: Patient,
            as: "patient",
            where: {
              doctorId: doctorId,
            },
          },
        ],
        order: [
          ["status", "DESC"],
          ["createdAt", "ASC"],
        ],
      });

      return res.status(200).json({
        firstAppointment: appointment
          ? {
              ...appointment.toJSON(),
              document: getDecryptedDocumentAsBase64(appointment.document),
            }
          : null,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to retrieve appointments",
      });
    }
  },

  async cancelAppointment(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const appointmentId = req.params.appointmentId;
      const appointment = await Appointment.findOne({
        where: {
          id: appointmentId,
        },
        attributes: ["id", "status"],
        include: [
          {
            model: Patient,
            as: "patient",
          },
        ],
        transaction,
      });

      if (!appointment) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Appointment not found." });
      }

      if (appointment.status !== null) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Can't cancel already proceed appointment" });
      }

      appointment.status = "cancel";

      appointment.save({ transaction });

      await AuditLog.create(
        {
          action: `Cancel appointment`,
          details: `Appointment (${appointmentId}) cancel`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      const appointmentDate = moment
        .tz(appointment.date, "Asia/Kolkata")
        .startOf("day");
      const todayIST = moment.tz("Asia/Kolkata").startOf("day");

      if (appointmentDate.isSame(todayIST, "day")) {
        update(
          {
            event: "cancelAppointment",
            appointment: {
              ...appointment.toJSON(),
              patient: appointment.patient,
            },
          },
          req.user.hospitalId
        );
      }

      res.status(200).json({ message: "Appointment cancel successfully." });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({
        error: "Failed to cancel appointment",
      });
    }
  },

  async reScheduleAppointment(req, res) {
    const { date, process, appointmentTime } = req.body;
    const transaction = await sequelize.transaction();
    try {
      const appointmentId = req.params.appointmentId;
      const appointment = await Appointment.findOne({
        where: {
          id: appointmentId,
        },
        attributes: [
          "id",
          "status",
          "process",
          "date",
          "appointmentTime",
          "patientId",
        ],
        include: [
          {
            model: Patient,
            as: "patient",
          },
        ],
        transaction,
      });

      if (!appointment) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Appointment not found." });
      }

      if (appointment.status !== null) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Can't re-schedule already proceed appointment." });
      }

      const appointmentDate = moment.tz(date, "Asia/Kolkata").startOf("day");
      const todayIST = moment.tz("Asia/Kolkata").startOf("day");

      if (appointmentDate.isBefore(todayIST)) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Appointment date cannot be in the past" });
      }
      const extAppointmentDate = moment
        .tz(appointment.date, "Asia/Kolkata")
        .startOf("day");
      if (appointmentDate.isSame(extAppointmentDate)) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Can't reschedule for same day." });
      }

      const startOfDay = appointmentDate.clone().startOf("day").toDate();
      const endOfDay = appointmentDate.clone().endOf("day").toDate();

      const existingAppointment = await Appointment.findOne({
        where: {
          patientId: appointment.patientId,
          date: {
            [Op.between]: [startOfDay, endOfDay],
          },
        },
        transaction,
      });

      if (existingAppointment) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Patient already has an appointment on this date" });
      }

      appointment.date = date;
      appointment.process = process;
      appointment.appointmentTime = appointmentTime;
      appointment.save({ transaction });

      await AuditLog.create(
        {
          action: "Reschedule appointment",
          details: `Reschedule appointment (${appointmentId})`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      update(
        {
          event: "rescheduleAppointment",
          appointment: {
            ...appointment.toJSON(),
            patient: appointment.patient,
          },
        },
        req.user.hospitalId
      );

      res
        .status(200)
        .json({ message: "Appointment re-schedule successfully." });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({
        error: "Failed to re-schedule appointment",
      });
    }
  },
};

module.exports = patientController;
