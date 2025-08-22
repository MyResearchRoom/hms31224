const {
  Doctor,
  Receptionist,
  ReceptionistDocument,
  Attendance,
  sequelize,
} = require("../models");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const { Op } = require("sequelize");
const momentTimezone = require("moment-timezone");
const { getDecryptedDocumentAsBase64 } = require("../utils/cryptography");

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

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      const receptionistId = await generateUniqueReceptionistId(name);

      let profile = null;
      if (req.files?.profile && req.files?.profile?.length > 0) {
        profile = req.files?.profile[0]?.buffer
          ? `data:${req.files?.profile[0]?.mimetype
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
          age,
          dateOfJoining,
          gender,
          qualification,
          receptionistId,
          profile: profile,
          password: hashedPassword,
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
            receptionistId: newReceptionist.id,
          },
          { transaction }
        );
      }

      await transaction.commit();

      return res.status(201).json({
        message: "Receptionist added successfully!",
        newReceptionist: {
          ...newReceptionist?.toJSON(),
          profile: req.files["profile"]
            ? `data:${req.files?.profile[0]?.mimetype
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
              receptionistId: receptionist.id,
            },
            { transaction }
          );
        }
      }

      await transaction.commit();

      receptionist.password = "";
      return res.status(200).json({
        message: "Receptionist updated successfully!",
        receptionist,
      });
    } catch (error) {
      await transaction.rollback();
      console.log(error);

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
      // Check if the receptionist exists
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

      // Delete the receptionist
      await receptionist.destroy({ transaction });

      await transaction.commit();
      return res
        .status(200)
        .json({ message: "Receptionist removed successfully!" });
    } catch (error) {
      await transaction.rollback();
      return res.status(500).json({
        error: "Failed to remove receptionist",
        details: error.message,
      });
    }
  },

  async getAllReceptionists(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" }); // Unauthorized
    }

    try {
      // Get all receptionists for the logged-in doctor
      const receptionists = await Receptionist.findAll({
        where: {
          doctorId: req.user.id,
        },
        attributes: ["id", "receptionistId", "name", "dateOfJoining"],
      });

      const today = new Date().toISOString().split("T")[0];

      const endOfToday = moment().endOf("day").toDate(); // End of today

      // Fetch today's attendance for each receptionist
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

          // Set availability status based on whether attendance record exists
          const availabilityStatus = attendance ? "Available" : "Not Available";

          return {
            ...receptionist.toJSON(),
            availabilityStatus, // Add the availability status for each receptionist
          };
        })
      );

      res.status(200).json({ receptionists: receptionistWithAttendance });
    } catch (error) {
      console.error(error);
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
      return res
        .status(500)
        .json({ error: "Failed to change password", details: error.message });
    }
  },

  async getReceptionistById(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" }); // Unauthorized
    }

    try {
      const receptionist = await Receptionist.findOne({
        where: { id: req.params.id },
        include: [
          {
            model: ReceptionistDocument,
            as: "documents",
            attributes: ["id", "document", "contentType"],
          },
        ],
      });

      if (!receptionist) {
        return res.status(404).json({ error: "Receptionist not found" });
      }

      receptionist.password = "";

      res.status(200).json({
        receptionist: {
          ...receptionist.toJSON(),
          profile: receptionist.profile
            ? getDecryptedDocumentAsBase64(receptionist.profile)
            : null,
        },
      });
    } catch (error) {
      console.log(error);

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
              attributes: ["document", "contentType"],
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
                    // Get the start of today (00:00:00) in IST
                    moment().tz("Asia/Kolkata").startOf("day").toDate(),
                    // Get the end of today (23:59:59) in IST
                    moment().tz("Asia/Kolkata").endOf("day").toDate(),
                  ],
                },
              },
              as: "atendances",
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
            "registrationAuthority",
            "dateOfBirth",
            "age",
            "governmentId",
            "specialization",
            "alternateContactNo",
            "dateOfRegistration",
            "gender",
            "medicalDegree",
            "profile",
            "profileContentType",
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
      console.log(error);
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

    try {
      let user;

      if (req.user.role === "receptionist") {
        user = await Receptionist.findOne({
          where: { id: req.user.id },
          attributes: ["id", "profile", "profileContentType"],
        });
      } else {
        user = await Doctor.findOne({
          where: { id: req.user.id },
          attributes: ["id", "profile", "profileContentType"],
        });
      }

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      user.profile = `data:${req.file.mimetype
        };base64,${req.file.buffer.toString("base64")}`;

      // no more needed
      // user.profileContentType = req.file.mimetype;

      user.save();

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

    try {
      // Get today's date in IST (Asia/Kolkata time zone)
      const today = momentTimezone().tz("Asia/Kolkata").format("YYYY-MM-DD");

      // Ensure receptionist has not already checked in for today
      const alreadyCheckedIn = await Attendance.findOne({
        where: {
          receptionistId,
          date: today,
        },
      });

      if (alreadyCheckedIn) {
        return res.status(400).json({ error: "Already checked in today" });
      }

      // Record check-in time in IST
      const attendance = await Attendance.create({
        receptionistId,
        checkInTime: momentTimezone().tz("Asia/Kolkata").format(),
        date: today,
      });

      return res.status(200).json({ message: "Checked in successfully" });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to check in",
        details: error.message,
      });
    }
  },

  async checkOut(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const receptionistId = req.user.id;

    // Get today's date in IST (Asia/Kolkata time zone)
    const today = momentTimezone().tz("Asia/Kolkata").format("YYYY-MM-DD");

    try {
      // Find the receptionist's attendance record for today
      const attendance = await Attendance.findOne({
        where: {
          receptionistId,
          date: today,
        },
      });

      if (!attendance) {
        return res.status(404).json({ error: "Check-in not found for today" });
      }

      if (attendance.checkOutTime) {
        return res.status(400).json({ error: "Already checked out today" });
      }

      // Record check-out time in IST
      attendance.checkOutTime = momentTimezone().tz("Asia/Kolkata").format();
      await attendance.save();

      return res.status(200).json({ message: "Checked out successfully" });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to check out",
        details: error.message,
      });
    }
  },

  async getReceptionistAttendanceStats(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const receptionistId = req.params.id;

    try {
      // Fetch all attendance records for the given receptionist
      const receptionist = await Receptionist.findOne({
        where: { id: receptionistId },
        attributes: [
          "name",
          "email",
          "mobileNumber",
          "receptionistId",
          "profile",
          "profileContentType",
        ],
        include: [
          {
            model: Attendance,
            as: "atendances",
            attributes: ["date", "checkInTime", "checkOutTime"],
          },
        ],
      });

      const attendanceRecords = receptionist.atendances;

      if (attendanceRecords.length === 0) {
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

      // Total attendance count
      const totalAttendance = attendanceRecords.length;

      // Calculate average check-in and check-out times
      let totalCheckInTime = 0;
      let totalCheckOutTime = 0;
      let totalCheckOutCount = 0;

      attendanceRecords.forEach((record) => {
        // Convert check-in time to IST (Asia/Kolkata)
        const checkInTime = moment
          .tz(record.checkInTime, "UTC")
          .tz("Asia/Kolkata");
        totalCheckInTime += checkInTime.valueOf(); // Add to total check-in time in milliseconds

        // Only consider check-out times that are present, and convert to IST
        if (record.checkOutTime) {
          const checkOutTime = moment
            .tz(record.checkOutTime, "UTC")
            .tz("Asia/Kolkata");
          totalCheckOutTime += checkOutTime.valueOf(); // Add to total check-out time in milliseconds
          totalCheckOutCount++;
        }
      });

      // Calculate averages (convert milliseconds to human-readable time)
      const avgCheckInTime = new Date(totalCheckInTime / totalAttendance)
        .toISOString()
        .slice(11, 19); // HH:MM:SS

      const avgCheckOutTime =
        totalCheckOutCount > 0
          ? new Date(totalCheckOutTime / totalCheckOutCount)
            .toISOString()
            .slice(11, 19)
          : null;

      return res.status(200).json({
        totalAttendance,
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
        details: error.message,
      });
    }
  },

  // async getAttendanceHistoryByMonth(req, res) {
  //   if (!req.user || req.user.role !== "doctor") {
  //     return res.status(401).json({ error: "Unauthorized request" });
  //   }

  //   const receptionistId = req.params.id;
  //   const { month, year, status } = req.query;

  //   try {
  //     const selectedMonth = month ? parseInt(month) : new Date().getMonth() + 1;
  //     const selectedYear = year ? parseInt(year) : new Date().getFullYear();

  //     const startDate = moment(`${selectedYear}-${selectedMonth}-01`);
  //     let endDate = moment(`${selectedYear}-${selectedMonth}-01`).endOf(
  //       "month"
  //     );

  //     // If the current month is requested, limit the end date to the end of yesterday
  //     if (moment().isSame(startDate, "month")) {
  //       endDate = moment().endOf("day"); // Set endDate to the end of yesterday (23:59:59)
  //     }

  //     const doctor = await Doctor.findOne({ id: req.user.id });

  //     // Fetch all attendance records for the receptionist in the given month
  //     const attendanceRecords = await Attendance.findAll({
  //       where: {
  //         receptionistId,
  //         checkInTime: {
  //           [Op.between]: [startDate.toDate(), endDate.toDate()],
  //         },
  //       },
  //       order: [["checkInTime", "ASC"]],
  //     });

  //     // Define working hours (for checking late or on-time status)
  //     const expectedCheckInTime = doctor.checkInTime || "09:00:00";
  //     const expectedCheckOutTime = doctor.checkOutTime || "17:00:00";

  //     // Create a map for attendance records, keyed by date
  //     const attendanceMap = {};
  //     attendanceRecords.forEach((record) => {
  //       const recordDate = moment(record.checkInTime).format("YYYY-MM-DD");
  //       attendanceMap[recordDate] = record;
  //     });

  //     // Loop through each day of the month and build attendance history
  //     const attendanceHistory = [];
  //     for (
  //       let day = startDate;
  //       day.isSameOrBefore(endDate);
  //       day.add(1, "days")
  //     ) {
  //       const currentDate = day.format("YYYY-MM-DD");
  //       const record = attendanceMap[currentDate];

  //       if (record) {
  //         // If an attendance record exists for the current date
  //         const checkIn = moment(record.checkInTime).format("HH:mm:ss");
  //         const checkOut = record.checkOutTime
  //           ? moment(record.checkOutTime).format("HH:mm:ss")
  //           : "00:00:00";

  //         // Determine status (on time or late)
  //         let recordStatus = "On Time";
  //         if (
  //           moment(record.checkInTime).isAfter(
  //             `${currentDate} ${expectedCheckInTime}`
  //           )
  //         ) {
  //           recordStatus = "Late";
  //         }

  //         attendanceHistory.push({
  //           date: currentDate,
  //           checkInTime: checkIn,
  //           checkOutTime: checkOut,
  //           status: recordStatus,
  //         });
  //       } else {
  //         // If no attendance record exists for the current date, mark as "Leave"
  //         attendanceHistory.push({
  //           date: currentDate,
  //           checkInTime: "00:00:00",
  //           checkOutTime: "00:00:00",
  //           status: "Leave",
  //         });
  //       }
  //     }

  //     // Apply the status filter if provided
  //     let filteredAttendanceHistory = attendanceHistory;
  //     if (status) {
  //       filteredAttendanceHistory = attendanceHistory.filter(
  //         (entry) => entry.status.toLowerCase() === status.toLowerCase()
  //       );
  //     }

  //     return res.status(200).json({
  //       attendanceHistory: filteredAttendanceHistory.reverse(),
  //     });
  //   } catch (error) {
  //     return res.status(500).json({
  //       error: "Failed to retrieve attendance history",
  //       details: error.message,
  //     });
  //   }
  // },

  // async getAttendanceHistoryByMonth(req, res) {
  //   if (!req.user || req.user.role !== "doctor") {
  //     return res.status(401).json({ error: "Unauthorized request" });
  //   }

  //   const receptionistId = req.params.id;
  //   const { month, year, status } = req.query;

  //   try {
  //     const selectedMonth = month ? parseInt(month) : new Date().getMonth() + 1;
  //     const selectedYear = year ? parseInt(year) : new Date().getFullYear();

  //     // Get the receptionist's dateOfJoining
  //     const receptionist = await Receptionist.findOne({
  //       where: { id: receptionistId },
  //     });
  //     if (!receptionist) {
  //       return res.status(404).json({ error: "Receptionist not found" });
  //     }

  //     const dateOfJoining = moment(receptionist.dateOfJoining);

  //     // Define the requested start and end dates
  //     const requestedStartDate = moment(`${selectedYear}-${selectedMonth}-01`);
  //     const startDate = moment.max(requestedStartDate, dateOfJoining);
  //     let endDate = moment(requestedStartDate).endOf("month");

  //     // If the current month is requested, limit the end date to yesterday's end
  //     if (moment().isSame(requestedStartDate, "month")) {
  //       endDate = moment().endOf("day"); // Include today's attendance if available
  //     }

  //     const doctor = await Doctor.findOne({ id: req.user.id });

  //     // Fetch all attendance records for the receptionist in the given period
  //     const attendanceRecords = await Attendance.findAll({
  //       where: {
  //         receptionistId,
  //         checkInTime: {
  //           [Op.between]: [startDate.toDate(), endDate.toDate()],
  //         },
  //       },
  //       order: [["checkInTime", "ASC"]],
  //     });

  //     // Define working hours (for determining late or on-time status)
  //     const expectedCheckInTime = doctor.checkInTime || "09:00:00";
  //     const expectedCheckOutTime = doctor.checkOutTime || "17:00:00";

  //     // Create a map for attendance records keyed by date
  //     const attendanceMap = {};
  //     attendanceRecords.forEach((record) => {
  //       const recordDate = moment(record.checkInTime).format("YYYY-MM-DD");

  //       attendanceMap[recordDate] = record;
  //     });

  //     // Loop through each day of the period and build attendance history
  //     const attendanceHistory = [];
  //     for (
  //       let day = startDate;
  //       day.isSameOrBefore(endDate);
  //       day.add(1, "days")
  //     ) {
  //       const currentDate = day.format("YYYY-MM-DD");
  //       const record = attendanceMap[currentDate];

  //       if (record) {
  //         // If an attendance record exists for the current date
  //         const checkIn = moment(record.checkInTime).format("HH:mm:ss");
  //         const checkOut = record.checkOutTime
  //           ? moment(record.checkOutTime).format("HH:mm:ss")
  //           : "00:00:00";

  //         // Determine status (on time or late)
  //         let recordStatus = "On Time";
  //         if (
  //           moment(record.checkInTime).isAfter(
  //             `${currentDate} ${expectedCheckInTime}`
  //           )
  //         ) {
  //           recordStatus = "Late";
  //         }

  //         attendanceHistory.push({
  //           date: currentDate,
  //           checkInTime: checkIn,
  //           checkOutTime: checkOut,
  //           status: recordStatus,
  //         });
  //       } else {
  //         // If no attendance record exists for the current date, mark as "Leave"
  //         attendanceHistory.push({
  //           date: currentDate,
  //           checkInTime: "00:00:00",
  //           checkOutTime: "00:00:00",
  //           status: "Leave",
  //         });
  //       }
  //     }

  //     // Apply the status filter if provided
  //     let filteredAttendanceHistory = attendanceHistory;
  //     if (status) {
  //       filteredAttendanceHistory = attendanceHistory.filter(
  //         (entry) => entry.status.toLowerCase() === status.toLowerCase()
  //       );
  //     }

  //     return res.status(200).json({
  //       attendanceHistory: filteredAttendanceHistory.reverse(),
  //     });
  //   } catch (error) {
  //     return res.status(500).json({
  //       error: "Failed to retrieve attendance history",
  //       details: error.message,
  //     });
  //   }
  // },

  async getAttendanceHistoryByMonth(req, res) {
    if (!req.user || req.user.role !== "doctor") {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const receptionistId = req.params.id;
    const { month, year, status } = req.query;

    try {
      const selectedMonth = month ? parseInt(month) : new Date().getMonth() + 1;
      const selectedYear = year ? parseInt(year) : new Date().getFullYear();

      // Get the receptionist's dateOfJoining
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

      // Define the requested start and end dates
      const requestedStartDate = moment(`${selectedYear}-${selectedMonth}-01`);
      const startDate = moment.max(requestedStartDate, dateOfJoining);
      let endDate = moment(requestedStartDate).endOf("month");

      // If the current month is requested, include today's attendance in IST
      if (moment().isSame(requestedStartDate, "month")) {
        endDate = moment.tz("Asia/Kolkata").endOf("day"); // Ensure the end date is in IST
      }

      const doctor = await Doctor.findOne({ id: req.user.id });

      // Fetch all attendance records for the receptionist in the given period
      const attendanceRecords = await Attendance.findAll({
        where: {
          receptionistId,
          checkInTime: {
            [Op.between]: [startDate.toDate(), endDate.toDate()],
          },
        },
        order: [["checkInTime", "ASC"]],
      });

      // Define working hours (for determining late or on-time status)
      const expectedCheckInTime = doctor.checkInTime || "09:00:00";
      const expectedCheckOutTime = doctor.checkOutTime || "17:00:00";

      // Create a map for attendance records keyed by date
      const attendanceMap = {};
      attendanceRecords.forEach((record) => {
        const recordDate = moment
          .tz(record.checkInTime, "Asia/Kolkata")
          .format("YYYY-MM-DD");
        attendanceMap[recordDate] = record;
      });

      // Loop through each day of the period and build attendance history
      const attendanceHistory = [];
      for (
        let day = startDate.clone();
        day.isSameOrBefore(endDate);
        day.add(1, "days")
      ) {
        const currentDate = day.format("YYYY-MM-DD");
        const record = attendanceMap[currentDate];

        if (record) {
          // If an attendance record exists for the current date
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

          // Determine status (on time or late)
          let recordStatus = "On Time";

          // Convert the expected check-in time (using IST) and compare it with actual check-in
          const expectedCheckInMoment = moment.tz(
            `${currentDate} ${expectedCheckInTime}`,
            "Asia/Kolkata"
          );

          // Check if the receptionist is late
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
            status: recordStatus,
          });
        } else {
          // If no attendance record exists for the current date, mark as "Leave"
          attendanceHistory.push({
            date: currentDate,
            checkInTime: "00:00:00",
            checkOutTime: "00:00:00",
            status: "Leave",
          });
        }
      }

      // Apply the status filter if provided
      let filteredAttendanceHistory = attendanceHistory;
      if (status) {
        filteredAttendanceHistory = attendanceHistory.filter(
          (entry) => entry.status.toLowerCase() === status.toLowerCase()
        );
      }

      return res.status(200).json({
        attendanceHistory: filteredAttendanceHistory.reverse(),
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to retrieve attendance history",
        details: error.message,
      });
    }
  },
};

module.exports = receptionistController;
