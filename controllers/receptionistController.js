const {
  Doctor,
  Receptionist,
  ReceptionistDocument,
  Attendance,
  AuditLog,
  sequelize,
  Notification,
} = require("../models");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const { Op } = require("sequelize");
const momentTimezone = require("moment-timezone");
const { getDecryptedDocumentAsBase64 } = require("../utils/cryptography");
const { updateCheckInOutNotification } = require("../websocket");
const constants = require("../utils/constants");
const { maskData } = require("../utils/maskData");
const { max_receptionist } = require("../config/config");

const generateUniqueReceptionistId = async (name) => {
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
    const existingDoctor = await Receptionist.findOne({
      where: { receptionistId: uniqueId },
    });

    // If the ID doesn't exist, it's unique
    if (!existingDoctor) {
      isUnique = true;
    }
  }

  return uniqueId;
};

const receptionistController = {
  async addReceptionist(req, res) {
    const {
      name,
      mobileNumber,
      address,
      email,
      dateOfBirth,
      age,
      dateOfJoining,
      gender,
      qualification,
      password,
      shiftId,
    } = req.body;

    const documents = req.files["documents[]"];
    if (!documents) {
      return res
        .status(400)
        .json({ error: "Please provide at least one document" });
    }

    const parsedDate = moment(dateOfBirth, "YYYY-MM-DD", true);
    const calculatedAge = moment().diff(parsedDate, "years");
    if (calculatedAge < 18) {
      return res.status(400).json({
        error: "Age must be 18 or older based on the date of birth",
      });
    }

    if (age < 18) {
      return res.status(400).json({ error: "Age must be 18 or older" });
    }

    const transaction = await sequelize.transaction();
    try {
      const existingDoctor = await Doctor.findOne({
        where: { email },
        transaction,
      });
      const existingReceptionist = await Receptionist.findOne({
        where: { email },
        transaction,
      });

      if (existingDoctor || existingReceptionist) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Email is already registered with another user." });
      }

      const receptionistCount = await Receptionist.count({
        where: {
          doctorId: req.user.hospitalId,
        },
        transaction,
      });

   

      if (receptionistCount >= max_receptionist) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({
          error: `You can't add more than ${max_receptionist} receptionsts.`,
        });
      }
      const hashedPassword = await bcrypt.hash(password, 10);

      const receptionistId = await generateUniqueReceptionistId(name);

      let profile = null;
      if (req.files?.profile && req.files?.profile?.length > 0) {
        profile = req.files?.profile[0]?.buffer
          ? `data:${
              req.files?.profile[0]?.mimetype
            };base64,${req.files?.profile[0]?.buffer.toString("base64")}`
          : null;
      }

      // Create the receptionist
      const newReceptionist = await Receptionist.create(
        {
          name,
          mobileNumber,
          address,
          email,
          dateOfBirth,
          age: calculatedAge,
          dateOfJoining,
          gender,
          qualification,
          receptionistId,
          profile: profile,
          password: hashedPassword,
          shiftId,
          doctorId: req.user.id,
        },
        { transaction }
      );

      // Store each document associated with the receptionist
      for (const file of documents) {
        await ReceptionistDocument.create(
          {
            document: `data:${file.mimetype};base64,${file.buffer.toString(
              "base64"
            )}`,
            contentType: file.mimetype,
            fileName: file.originalname,
            receptionistId: newReceptionist.id,
          },
          { transaction }
        );
      }

      const receptionistDataForAudit = {
        id: newReceptionist.id,
        receptionistId: newReceptionist.receptionistId,
        email: newReceptionist.email,
        age: newReceptionist.age,
        dateOfJoining: newReceptionist.dateOfJoining,
        gender: newReceptionist.gender,
        qualification: newReceptionist.qualification,
        shiftId: newReceptionist.shiftId,
      };

      await AuditLog.create(
        {
          action: constants.ADD_RECEPTIONIST,
          details: `Added receptionist ${name} with email ${email}`,
          hospitalId: req.user.hospitalId,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          receptionistId: null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Receptionist",
          entityId: newReceptionist.id,
          oldValue: null,
          newValue: maskData(
            {
              name,
              mobileNumber,
              address,
              dateOfBirth,
            },
            false
          ),
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(201).json({
        message: "Receptionist added successfully!",
        newReceptionist: {
          ...newReceptionist?.toJSON(),
          profile: req.files["profile"]
            ? `data:${
                req.files?.profile[0]?.mimetype
              };base64,${req.files?.profile[0]?.buffer.toString("base64")}`
            : null,
        },
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({
        error: "Failed to add receptionist",
      });
    }
  },

  async editReceptionist(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const receptionistId = req.params.id;
    const {
      name,
      mobileNumber,
      address,
      dateOfBirth,
      age,
      gender,
      qualification,
      dateOfJoining,
      shiftId,
    } = req.body;

    if (dateOfBirth) {
      const parsedDate = moment(dateOfBirth, "YYYY-MM-DD", true);
      const calculatedAge = moment().diff(parsedDate, "years");
      if (calculatedAge < 18) {
        return res.status(400).json({
          error: "Age must be 18 or older based on the date of birth",
        });
      }
    }

    if (age && age < 18) {
      return res.status(400).json({ error: "Age must be 18 or older" });
    }

    const documents = req.files["documents[]"];

    const transaction = await sequelize.transaction();
    try {
      const receptionist = await Receptionist.findOne({
        attributes: [
          "id",
          "name",
          "mobileNumber",
          "address",
          "dateOfBirth",
          "age",
          "gender",
          "qualification",
          "shiftId",
          "email",
          "dateOfJoining",
          "receptionistId",
        ],
        where: { id: receptionistId },
        transaction,
      });

      if (!receptionist) {
        await transaction.rollback();
        return res.status(404).json({ error: "Receptionist not found" });
      }

      await receptionist.update(
        {
          name: name || receptionist.name,
          mobileNumber: mobileNumber || receptionist.mobileNumber,
          address: address || receptionist.address,
          dateOfBirth: dateOfBirth || receptionist.dateOfBirth,
          age: age || receptionist.age,
          gender: gender || receptionist.gender,
          qualification: qualification || receptionist.qualification,
          shiftId: shiftId || receptionist.shiftId,
          dateOfJoining: dateOfJoining || receptionist.dateOfJoining,
        },
        { transaction }
      );

      // If new documents are provided, update receptionist documents
      if (documents && documents.length > 0) {
        // Delete old documents
        // await ReceptionistDocument.destroy({
        //   where: { receptionistId: receptionist.id },
        //   transaction,
        // });

        // Add new documents
        for (const file of documents) {
          await ReceptionistDocument.create(
            {
              document: `data:${file.mimetype};base64,${file.buffer.toString(
                "base64"
              )}`,
              contentType: file.mimetype,
              fileName: file.originalname,
              receptionistId: receptionist.id,
            },
            { transaction }
          );
        }
      }

      const receptionistDataForAudit = {
        id: receptionist.id,
        receptionistId: receptionist.receptionistId,
        email: receptionist.email,
      };

      await AuditLog.create(
        {
          action: constants.EDIT_RECEPTIONIST,
          details: `Edited receptionist ${receptionist.receptionistId} with email ${receptionist.email}`,
          hospitalId: req.user.hospitalId,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Receptionist",
          entityId: receptionist.id,
          oldValue: null,
          newValue: maskData(
            {
              name,
              mobileNumber,
              address,
              dateOfBirth,
            },
            false
          ),
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      receptionist.password = "";
      return res.status(200).json({
        message: "Receptionist updated successfully!",
        receptionist,
      });
    } catch (error) {
      await transaction.rollback();
      return res.status(500).json({
        error: "Failed to update receptionist",
      });
    }
  },

  async removeReceptionist(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const receptionistId = req.params.id;

    const transaction = await sequelize.transaction();
    try {
      const receptionist = await Receptionist.findOne({
        where: { id: receptionistId },
        transaction,
      });

      if (!receptionist) {
        await transaction.rollback();
        return res.status(404).json({ error: "Receptionist not found" });
      }

      // Delete all documents associated with the receptionist
      // await ReceptionistDocument.destroy({
      //   where: { receptionistId },
      //   transaction,
      // });

      const deletedValue = {
        id: receptionist.id,
        receptionistId: receptionist.receptionistId,
        email: receptionist.email,
      };

      await receptionist.destroy({ transaction });

      await AuditLog.create(
        {
          action: constants.REMOVE_RECEPTIONIST,
          details: `Deleted receptionist with receptionistId ${receptionist.receptionistId}`,
          hospitalId: req.user.hospitalId,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          receptionistId: null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Receptionist",
          entityId: receptionist.id,
          oldValue: deletedValue,
          newValue: { deleted: true },
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      return res
        .status(200)
        .json({ message: "Receptionist removed successfully!" });
    } catch (error) {
      await transaction.rollback();
      return res.status(500).json({
        error: "Failed to remove receptionist",
      });
    }
  },

  async getAllReceptionists(req, res) {
    try {
      const receptionists = await Receptionist.findAll({
        where: {
          doctorId: req.user.id,
        },
        attributes: ["id", "receptionistId", "name", "dateOfJoining"],
      });

      const today = new Date().toISOString().split("T")[0];

      const endOfToday = moment().endOf("day").toDate();

      const receptionistWithAttendance = await Promise.all(
        receptionists.map(async (receptionist) => {
          const attendance = await Attendance.findOne({
            where: {
              receptionistId: receptionist.id,
              date: {
                [Op.eq]: today,
              },
            },
          });

          const availabilityStatus = attendance ? "Available" : "Not Available";

          return {
            ...receptionist.toJSON(),
            availabilityStatus,
          };
        })
      );

      await AuditLog.create({
        action: constants.GET_ALL_RECEPTIONISTS,
        details: `${req.user.role} ${req.user.name} retrieved all receptionists`,
        hospitalId: req.user.hospitalId,
        doctorId: req.user.role === "doctor" ? req.user.id : null,
        receptionistId: req.user.role === "receptionist" ? req.user.id : null,
        role: req.user.role,
        token: req.header("Authorization")?.split(" ")[1],
        entity: "Receptionist",
        entityId: null,
        status: "success",
        endpoint: req.url,
        ipAddress: req.clientIp,
        userAgent: req.headers["user-agent"],
      });

      res.status(200).json({ receptionists: receptionistWithAttendance });
    } catch (error) {
      res.status(500).json({
        error: "Failed to retrieve receptionists",
      });
    }
  },

  async changePassword(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" }); // Unauthorized
    }

    const receptionistId = req.params.id;
    const { newPassword } = req.body;

    try {
      const receptionist = await Receptionist.findByPk(receptionistId, {
        attributes: ["id", "password"],
      });

      if (!receptionist) {
        return res.status(404).json({ error: "Receptionist not found" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      receptionist.password = hashedPassword;

      await receptionist.save();

      res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
      return res.status(500).json({ error: "Failed to change password" });
    }
  },

  async getReceptionistById(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" }); // Unauthorized
    }

    const transaction = await sequelize.transaction();

    try {
      const receptionist = await Receptionist.findOne({
        where: { id: req.params.id },
        include: [
          {
            model: ReceptionistDocument,
            as: "documents",
            attributes: ["id", "document", "contentType", "fileName"],
          },
        ],
        transaction,
      });

      if (!receptionist) {
        return res.status(404).json({ error: "Receptionist not found" });
      }

      receptionist.password = "";

      await AuditLog.create(
        {
          action: constants.GET_RECEPTIONIST_BY_ID,
          details: `${req.user.role} ${req.user.name} retrieved receptionist ${receptionist.receptionistId}`,
          hospitalId: req.user.hospitalId,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Receptionist",
          entityId: receptionist.id,
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      res.status(200).json({
        receptionist: {
          ...receptionist.toJSON(),
          profile: receptionist.profile
            ? getDecryptedDocumentAsBase64(receptionist.profile)
            : null,
        },
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to get receptionist" });
    }
  },

  async getMe(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    try {
      if (req.user.role === "receptionist") {
        const admin = await Receptionist.findOne({
          where: { id: req.user.id },
          include: [
            {
              model: ReceptionistDocument,
              as: "documents",
              attributes: ["document", "contentType", "fileName"],
            },
            {
              model: Doctor,
              as: "doctor",
              attributes: ["clinicName"],
            },
            {
              model: Attendance,
              where: {
                date: {
                  [Op.between]: [
                    moment().tz("Asia/Kolkata").startOf("day").toDate(),
                    moment().tz("Asia/Kolkata").endOf("day").toDate(),
                  ],
                },
              },
              as: "attendances",
              required: false,
            },
          ],
        });

        if (!admin) {
          return res.status(404).json({ error: "Receptionist not found" });
        }

        res.status(200).json({
          admin: {
            ...admin.toJSON(),
            profile: getDecryptedDocumentAsBase64(admin.profile),
          },
        });
      } else {
        const admin = await Doctor.findOne({
          where: { id: req.user.id },
          attributes: [
            "id",
            "doctorId",
            "name",
            "mobileNumber",
            "clinicName",
            "address",
            "medicalLicenceNumber",
            "email",
            "dateOfBirth",
            "specialization",
            "alternateContactNo",
            "gender",
            "medicalDegree",
            "profile",
            "profileContentType",
            "experience",
            "clinicAddress",
          ],
        });
        if (!admin) {
          return res.status(404).json({ error: "Doctor not found" });
        }

        res.status(200).json({
          admin: {
            ...admin.toJSON(),
            profile: getDecryptedDocumentAsBase64(admin.profile),
          },
        });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to get user" });
    }
  },

  async changeProfile(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const transaction = await sequelize.transaction();

    try {
      let user;

      if (req.user.role === "receptionist") {
        user = await Receptionist.findOne({
          where: { id: req.user.id },
          attributes: ["id", "profile", "profileContentType"],
          transaction,
        });
      } else {
        user = await Doctor.findOne({
          where: { id: req.user.id },
          attributes: ["id", "profile", "profileContentType"],
          transaction,
        });
      }

      if (!user) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "User not found" });
      }

      user.profile = `data:${
        req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;

      await user.save({ transaction });

      const profileDataForAudit = {
        hadProfile: true,
        profileContentType: req.file.mimetype,
      };

      // create audit log
      await AuditLog.create(
        {
          action: constants.CHANGE_PROFILE,
          details: `${req.user.role} ${req.user.name} updated profile picture`,
          hospitalId: req.user.hospitalId,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Receptionist",
          entityId: user.id,
          oldValue: null,
          newValue: profileDataForAudit,
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      res.status(200).json({
        message: "Profile updated successfully",
        profile: `data:${req.file.mimetype};base64,${req.file.buffer.toString(
          "base64"
        )}`,
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to update profile" });
    }
  },

  async checkIn(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const receptionistId = req.user.id;
    const transaction = await sequelize.transaction();

    try {
      const today = momentTimezone().tz("Asia/Kolkata").format("YYYY-MM-DD");
      const alreadyCheckedIn = await Attendance.findOne({
        where: {
          receptionistId,
          date: today,
        },
        transaction,
      });

      if (alreadyCheckedIn) {
        await transaction.rollback();
        return res.status(400).json({ error: "Already checked in today" });
      }

      let checkInTime;

      const attendance = await Attendance.create(
        {
          receptionistId,
          checkInTime: momentTimezone().tz("Asia/Kolkata").format(),
          date: today,
        },
        { transaction }
      );

      const data = await Notification.create(
        {
          doctorId: req.user.hospitalId,
          message: `Receptionist ${
            req.user.name
          } checked in at ${momentTimezone()
            .tz("Asia/Kolkata")
            .format("hh:mm A, DD MMM YYYY")}.`,
        },
        { transaction }
      );

      updateCheckInOutNotification(
        {
          type: "notification",
          data,
        },
        req.user.hospitalId
      );

      const checkInDataForAudit = {
        attendanceId: attendance.id,
        receptionistId: receptionistId,
        name: req.user.name,
        checkInTime: momentTimezone(checkInTime)
          .tz("Asia/Kolkata")
          .format("hh:mm A, DD MMM YYYY"),
        date: today,
      };

      await AuditLog.create(
        {
          action: constants.RECEPTIONIST_CHECKIN,
          details: `Receptionist with name ${req.user.name} checked in`,
          hospitalId: req.user.hospitalId,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Receptionist",
          entityId: receptionistId,
          oldValue: null,
          newValue: checkInDataForAudit,
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(200).json({ message: "Checked in successfully" });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to check in",
      });
    }
  },

  async checkOut(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const receptionistId = req.user.id;
    const transaction = await sequelize.transaction();

    // Get today's date in IST (Asia/Kolkata time zone)
    const today = momentTimezone().tz("Asia/Kolkata").format("YYYY-MM-DD");

    try {
      // Find the receptionist's attendance record for today
      const attendance = await Attendance.findOne({
        where: {
          receptionistId,
          date: today,
        },
        transaction,
      });

      if (!attendance) {
        return res.status(404).json({ error: "Check-in not found for today" });
      }

      if (attendance.checkOutTime) {
        await transaction.rollback();
        return res.status(400).json({ error: "Already checked out today" });
      }

      let checkOutTime;

      // Record check-out time in IST
      attendance.checkOutTime = momentTimezone().tz("Asia/Kolkata").format();
      await attendance.save();

      const data = await Notification.create(
        {
          doctorId: req.user.hospitalId,
          message: `Receptionist ${
            req.user.name
            // } checked out at ${new Date().toLocaleString()}.`,
          } checked out at ${momentTimezone()
            .tz("Asia/Kolkata")
            .format("hh:mm A, DD MMM YYYY")}.`,
        },
        { transaction }
      );

      updateCheckInOutNotification(
        {
          type: "notification",
          data,
        },
        req.user.hospitalId
      );

      const checkOutDataForAudit = {
        attendanceId: attendance.id,
        receptionistId: receptionistId,
        name: req.user.name,
        checkOutTime: momentTimezone(checkOutTime)
          .tz("Asia/Kolkata")
          .format("hh:mm A, DD MMM YYYY"),
        date: today,
      };

      await AuditLog.create(
        {
          action: constants.RECEPTIONIST_CHECKOUT,
          details: `Receptionist with name ${req.user.name} checked out`,
          hospitalId: req.user.hospitalId,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Receptionist",
          entityId: receptionistId,
          oldValue: null,
          newValue: checkOutDataForAudit,
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(200).json({ message: "Checked out successfully" });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to check out",
      });
    }
  },

  async getReceptionistAttendanceStats(req, res) {
    const receptionistId = req.params.id;

    try {
      const { month, year } = req.query;
      const currentMonth = month || moment().month() + 1;
      const currentYear = year || moment().year();

      let startOfMonth = moment(
        `${currentYear}-${currentMonth}-01`,
        "YYYY-MM-DD"
      )
        .startOf("month")
        .toDate();

      const endOfMonth = moment(
        `${currentYear}-${currentMonth}-01`,
        "YYYY-MM-DD"
      )
        .endOf("month")
        .toDate();

      const receptionist = await Receptionist.findOne({
        where: { id: receptionistId },
        attributes: [
          "name",
          "email",
          "mobileNumber",
          "receptionistId",
          "profile",
          "profileContentType",
          "dateOfJoining",
        ],
        include: [
          {
            model: Attendance,
            as: "attendances",
            attributes: ["date", "checkInTime", "checkOutTime"],
            where: {
              date: {
                [Op.between]: [startOfMonth, endOfMonth],
              },
            },
            required: false,
          },
        ],
      });

      const doj = moment(receptionist.dateOfJoining).startOf("day");
      if (doj.isAfter(endOfMonth)) {
        return res.status(400).json({
          error: "No attendance data available for the selected month",
        });
      }
      if (doj.isAfter(startOfMonth)) {
        startOfMonth = doj.toDate();
      }

      const attendanceRecords = receptionist.attendances;

      if (attendanceRecords.length === 0) {
        await AuditLog.create({
          action: constants.GET_RECEPTIONIST_ATTENDANCE_STATS,
          details: `${req.user.role} ${req.user.name} checked attendance stats for receptionist ${receptionist.receptionistId} (no records found)`,
          hospitalId: req.user.hospitalId,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          doctorId: req.user.role === "receptionist " ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Receptionist",
          entityId: receptionist.id,
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        });

        return res.status(200).json({
          totalAttendance: 0,
          avgCheckInTime: "00:00:00",
          avgCheckOutTime: "00:00:00",
          receptionist: {
            ...receptionist.toJSON(),
            profile: getDecryptedDocumentAsBase64(receptionist.profile),
          },
        });
      }

      const totalAttendance = attendanceRecords.length;

      let totalCheckInTime = 0;
      let totalCheckOutTime = 0;
      let totalCheckOutCount = 0;
      let totalWorkingDays = 0;
      let leaveCount = 0;
      let totalHoursWorked = 0;

      let today = moment().startOf("day");
      if (moment().isAfter(endOfMonth)) {
        today = moment(endOfMonth).startOf("day");
      }

      let temp = moment(startOfMonth);

      while (temp.isSameOrBefore(today)) {
        const day = temp.day();
        if (day !== 0 && day !== 6) {
          totalWorkingDays++;
        }
        temp.add(1, "day");
      }

      leaveCount = totalWorkingDays - totalAttendance;

      attendanceRecords.forEach((record) => {
        const checkInTime = moment
          .tz(record.checkInTime, "UTC")
          .tz("Asia/Kolkata");
        totalCheckInTime += checkInTime.valueOf();

        if (record.checkOutTime) {
          const checkOutTime = moment
            .tz(record.checkOutTime, "UTC")
            .tz("Asia/Kolkata");
          totalCheckOutTime += checkOutTime.valueOf();
          totalCheckOutCount++;
        }

        if (record.checkOutTime) {
          totalHoursWorked += moment(record.checkOutTime).diff(
            moment(record.checkInTime),
            "hours"
          );
        }
      });

      // const avgCheckInTime = new Date(totalCheckInTime / totalAttendance)
      //   .toISOString()
      //   .slice(11, 19);

      // const avgCheckOutTime =
      //   totalCheckOutCount > 0
      //     ? new Date(totalCheckOutTime / totalCheckOutCount)
      //         .toISOString()
      //         .slice(11, 19)
      //     : null;

      const avgCheckInTime =
        totalAttendance > 0
          ? new Date(totalCheckInTime / totalAttendance).toLocaleTimeString(
              "en-US",
              { timeZone: "Asia/Kolkata", hour12: false }
            )
          : null; // HH:MM:SS-

      const avgCheckOutTime =
        totalCheckOutCount > 0
          ? new Date(totalCheckOutTime / totalCheckOutCount).toLocaleTimeString(
              "en-US",
              { timeZone: "Asia/Kolkata", hour12: false }
            )
          : null;

      return res.status(200).json({
        totalAttendance,
        leaveCount,
        totalHoursWorked,
        avgCheckInTime,
        avgCheckOutTime: avgCheckOutTime || "No check-out records found",
        receptionist: {
          ...receptionist.toJSON(),
          profile: getDecryptedDocumentAsBase64(receptionist.profile),
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: "Internal Server Error",
      });
    }
  },

  async getAttendanceHistoryByMonth(req, res) {
    const receptionistId = req.params.id || req.user.id;
    const { month, year, status } = req.query;

    try {
      const selectedMonth = month ? parseInt(month) : new Date().getMonth() + 1;
      const selectedYear = year ? parseInt(year) : new Date().getFullYear();

      const receptionist = await Receptionist.findOne({
        where: { id: receptionistId },
      });

      if (!receptionist) {
        return res.status(404).json({ error: "Receptionist not found" });
      }

      const dateOfJoining = moment(receptionist.dateOfJoining);
      if (!dateOfJoining.isValid()) {
        return res.status(400).json({ error: "Invalid date of joining" });
      }

      const requestedStartDate = moment(
        `${selectedYear}-${selectedMonth}-01`,
        "YYYY-MM-DD"
      );
      const startDate = moment.max(requestedStartDate, dateOfJoining);
      let endDate = moment(requestedStartDate).endOf("month");

      if (moment().isSame(requestedStartDate, "month")) {
        endDate = moment.tz("Asia/Kolkata").endOf("day");
      }

      const doctor = await Doctor.findOne({
        where: {
          id: req.user.hospitalId,
        },
      });

      const attendanceRecords = await Attendance.findAll({
        where: {
          receptionistId,
          checkInTime: {
            [Op.between]: [startDate.toDate(), endDate.toDate()],
          },
        },
        order: [["checkInTime", "ASC"]],
      });

      const expectedCheckInTime = doctor.checkInTime || "09:00:00";
      const expectedCheckOutTime = doctor.checkOutTime || "17:00:00";

      const attendanceMap = {};
      attendanceRecords.forEach((record) => {
        const recordDate = moment
          .tz(record.checkInTime, "Asia/Kolkata")
          .format("YYYY-MM-DD");
        attendanceMap[recordDate] = record;
      });

      const attendanceHistory = [];
      for (
        let day = startDate.clone();
        day.isSameOrBefore(endDate);
        day.add(1, "days")
      ) {
        const currentDate = day.format("YYYY-MM-DD");
        const record = attendanceMap[currentDate];

        if (record) {
          const checkIn = moment
            .tz(record.checkInTime, "UTC")
            .tz("Asia/Kolkata")
            .format("HH:mm:ss");
          const checkOut = record.checkOutTime
            ? moment
                .tz(record.checkOutTime, "UTC")
                .tz("Asia/Kolkata")
                .format("HH:mm:ss")
            : "00:00:00";
          const totalHours = record.checkOutTime
            ? moment(record.checkOutTime).diff(
                moment(record.checkInTime),
                "hours",
                true
              )
            : "NA";
          let recordStatus = "On Time";

          const expectedCheckInMoment = moment.tz(
            `${currentDate} ${expectedCheckInTime}`,
            "Asia/Kolkata"
          );

          if (
            moment
              .tz(record.checkInTime, "UTC")
              .tz("Asia/Kolkata")
              .isAfter(expectedCheckInMoment)
          ) {
            recordStatus = "Late";
          }

          attendanceHistory.push({
            date: currentDate,
            checkInTime: checkIn,
            checkOutTime: checkOut,
            totalHours: totalHours > 0 ? totalHours.toFixed(2) : "0.00",
            status: recordStatus,
          });
        } else {
          attendanceHistory.push({
            date: currentDate,
            checkInTime: "00:00:00",
            checkOutTime: "00:00:00",
            totalHours: "0.00",
            status: "Leave",
          });
        }
      }

      let filteredAttendanceHistory = attendanceHistory;
      if (status) {
        filteredAttendanceHistory = attendanceHistory.filter(
          (entry) => entry.status.toLowerCase() === status.toLowerCase()
        );
      }

      await AuditLog.create({
        action: constants.GET_RECEPTIONIST_ATTENDANCE_HISTORY,
        details: `${req.user.role} ${
          req.user.name
        } retrieved attendance history for receptionist ${
          receptionist.receptionistId
        } (month: ${selectedMonth}, year: ${selectedYear}, status: ${
          status || "all"
        })`,
        hospitalId: req.user.hospitalId,
        doctorId: req.user.role === "doctor" ? req.user.id : null,
        receptionistId: req.user.role === "receptionist" ? req.user.id : null,
        role: req.user.role,
        token: req.header("Authorization")?.split(" ")[1],
        entity: "Receptionist",
        entityId: receptionist.id,
        status: "success",
        endpoint: req.url,
        ipAddress: req.clientIp,
        userAgent: req.headers["user-agent"],
      });

      return res.status(200).json({
        attendanceHistory: filteredAttendanceHistory.reverse(),
      });
    } catch (error) {
      console.log(error);

      return res.status(500).json({
        error: "Failed to retrieve attendance history",
      });
    }
  },
};

module.exports = receptionistController;
