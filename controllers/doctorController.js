const {
  Doctor,
  Receptionist,
  Appointment,
  Patient,
  SetFee,
  Shift,
  AuditLog,
  DoctorAvailability,
  sequelize,
} = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ExcelJS = require("exceljs");
const { transporter } = require("../services/emailService");
const { Op, fn, literal, col } = require("sequelize");
const moment = require("moment");
const crypto = require("crypto");
const {
  getDecryptedDocumentAsBase64,
  decrypt,
  encrypt,
} = require("../utils/cryptography");
const { generateRandomMapping } = require("../utils/generateRandomMapping");
const constants = require("../utils/constants");
const { header } = require("express-validator");
const { maskData } = require("../utils/maskData");

const generateUniqueDoctorId = async (name) => {
  const nameParts = name.split(" ");
  const initials = nameParts
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  let uniqueId;
  let isUnique = false;

  while (!isUnique) {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    uniqueId = `${initials}${randomDigits}`;

    const existingDoctor = await Doctor.findOne({
      where: { doctorId: uniqueId },
    });

    if (!existingDoctor) {
      isUnique = true;
    }
  }

  return uniqueId;
};

const doctorController = {
  async register(req, res) {
    const {
      name,
      clinicName,
      mobileNumber,
      address,
      email,
      dateOfBirth,
      gender,
      password,
      medicalLicenceNumber,
      registrationAuthority,
      dateOfRegistration,
      medicalDegree,
      governmentId,
      specialization,
      alternateContactNo,
      experience,
      clinicAddress,
    } = req.body;

    try {
      const existingDoctor = await Doctor.findOne({ where: { email } });

      const existingReceptionist = await Receptionist.findOne({
        where: { email },
      });

      if (existingDoctor && existingDoctor.verified === true) {
        return res.status(400).json({
          message: "Email is already registered & verified. Please login.",
        });
      } else if (existingDoctor) {
        return res.status(400).json({
          message:
            "Email is already exists, Please go through verification email, which is sent to your email.",
        });
      } else if (existingReceptionist) {
        return res
          .status(400)
          .json({ error: "Email is already registered with another user." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const token = crypto.randomBytes(32).toString("hex");
      const doctorId = await generateUniqueDoctorId(name);

      await Doctor.create({
        name,
        clinicName,
        doctorId,
        mobileNumber,
        address,
        email,
        dateOfBirth,
        gender,
        medicalLicenceNumber,
        registrationAuthority,
        dateOfRegistration,
        medicalDegree,
        governmentId,
        specialization,
        alternateContactNo,
        experience,
        clinicAddress,
        mapping: encrypt(JSON.stringify(generateRandomMapping())),
        profile: req.file
          ? `data:${req.file.mimetype};base64,${req.file.buffer.toString(
              "base64"
            )}`
          : null,
        profileContentType: req.file?.mimetype || null,
        password: hashedPassword,
        verificationToken: token,
      });

      const registrationDate = new Date(dateOfRegistration);

      if (registrationDate > new Date()) {
        return res
          .status(400)
          .json({ error: "Registration date cannot be in the future." });
      }

      const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: "Verify your email",
        html: `<p>Click <a href="${process.env.CLIENT_URL}/api/auth/verify/${token}">here</a> to verify your email.</p> </hr>
        <p>if its not you then please Click <a href="${process.env.CLIENT_URL}/api/auth/remove/${token}">here</a> to remove your email.</p>`,
      };

      await transporter.sendMail(mailOptions);

      return res.status(201).json({
        message: "Doctor registered successfully, Please verify your email.",
        doctorId,
      });
    } catch (error) {
      return res.status(500).json({ error: "Registration failed" });
    }
  },

  async verifyEmail(req, res) {
    const { token } = req.params;

    const transaction = await sequelize.transaction();
    try {
      const user = await Doctor.findOne({
        attributes: ["id", "verified", "email"],
        where: { verificationToken: token },
        transaction,
      });

      if (!user) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ error: "Invalid or expired token" });
      }

      user.verified = true;
      await user.save({ transaction });

      await AuditLog.create(
        {
          action: constants.VERIFY_OTP,
          details: `Email verified by user, Id: ${user.id}, email: ${user.email}`,
          hospitalId: user.id,
          receptionistId: null,
          doctorId: user.id,
          role: "doctor",
          token,
          entity: "Doctor",
          entityId: user.id,
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      return res.status(200).json({ message: "Email verified successfully" });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({
        error: "Failed to verify email",
      });
    }
  },

  async removeEmail(req, res) {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: "Verification token is required" });
    }

    const transaction = await sequelize.transaction();
    try {
      const user = await Doctor.findOne({
        attributes: ["verified"],
        where: { verificationToken: token },
        transaction,
      });

      if (!user) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Invalid or expired verification URL" });
      }

      if (user.verified) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ error: "Email is already verified" });
      }

      await user.destroy({ transaction });

      await transaction.commit();

      return res.status(200).json({ message: "Email removed successfully" });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({
        error: "Failed to remove email",
      });
    }
  },

  async login(req, res) {
    const { email, password } = req.body;

    const transaction = await sequelize.transaction();
    try {
      let user;
      let userType;
      let acceptedTAndC;
      let hospitalId;

      user = await Doctor.findOne({
        where: { email },
        attributes: [
          "id",
          "email",
          "password",
          "verified",
          "acceptedTAndC",
          "verificationToken",
          "otp",
          "otpExpiry",
        ],
        transaction,
      });
      if (user) {
        userType = "doctor";
        acceptedTAndC = user.acceptedTAndC;
        hospitalId = user.id;
      }

      if (!user) {
        user = await Receptionist.findOne({
          where: { email },
          attributes: [
            "id",
            "email",
            "password",
            "doctorId",
            "otp",
            "otpExpiry",
          ],
        });
        if (user) {
          userType = "receptionist";
          hospitalId = user.doctorId;
        }
      }

      if (!user) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "User not found" });
      }

      if (userType === "doctor" && user.verified === false) {
        const token = crypto.randomBytes(32).toString("hex");

        user.verificationToken = token;
        await user.save();

        const mailOptions = {
          from: process.env.EMAIL,
          to: email,
          subject: "Verify your email",
          html: `<p>Click <a href="${process.env.CLIENT_URL}/api/auth/verify/${token}">here</a> to verify your email.</p>`,
        };

        await transporter.sendMail(mailOptions);
        return res.status(400).json({ error: "Please verify your email" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otp = otp;
      user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
      await user.save({ transaction });

      const otpMailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: "Your Login OTP",
        html: `<p>Your OTP for login is <b>${otp}</b>. It will expire in 5 minutes.</p>`,
      };
      await transporter.sendMail(otpMailOptions);

      await AuditLog.create(
        {
          action: constants.LOGIN,
          details: `User(${userType}) trying to login with otp, ID: ${user.id}, email: ${user.email}`,
          hospitalId,
          receptionistId: userType === "receptionist" ? user.id : null,
          doctorId: userType === "doctor" ? user.id : null,
          role: userType,
          token: req.header("Authorization")?.split(" ")[1],
          entity: userType === "doctor" ? "Doctor" : "Receptionist",
          status: "success",
          endpoint: req.url,
          entityId: user.id,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "OTP sent to your registered Mail Id",
        hospitalId,
        role: userType,
        acceptedTAndC,
      });
    } catch (error) {
      console.log(error);

      return res.status(500).json({ error: "Failed to send OTP" });
    }
  },

  async verifyOTP(req, res) {
    const { email, otp } = req.body;

    const transaction = await sequelize.transaction();
    try {
      let user, userType, acceptedTAndC, hospitalId;
      user = await Doctor.findOne({
        where: { email },
        attributes: ["id", "acceptedTAndC", "otp", "otpExpiry", "email"],
        transaction,
      });
      if (user) {
        userType = "doctor";
        acceptedTAndC = user.acceptedTAndC;
        hospitalId = user.id;
      }

      if (!user) {
        user = await Receptionist.findOne({
          where: { email },
          attributes: ["id", "otp", "otpExpiry", "email", "doctorId"],
          transaction,
        });
        if (user) {
          userType = "receptionist";
          hospitalId = user.doctorId;
        }
      }

      if (!user) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "User not found" });
      }

      if (String(user.otp) !== String(otp)) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ error: "Invalid OTP" });
      }

      if (Date.now() > new Date(user.otpExpiry).getTime()) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ error: "OTP expired" });
      }

      user.otp = null;
      user.otpExpiry = null;
      await user.save({ transaction });

      const payload = {
        id: user.id,
        email: user.email,
        role: userType,
        hospitalId,
      };
      if (userType === "doctor") payload.acceptedTAndC = acceptedTAndC;

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "1d",
      });

      await AuditLog.create(
        {
          action: constants.VERIFY_OTP,
          details: `OTP verification for login for User (${userType}), Id: ${user.id}, email: ${user.email} done.`,
          hospitalId,
          receptionistId: userType === "receptionist" ? user.id : null,
          doctorId: userType === "doctor" ? user.id : null,
          role: userType,
          entity: userType === "doctor" ? "Doctor" : "Receptionist",
          entityId: user.id,
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      return res.status(200).json({
        message: "OTP verified successfully",
        token,
        hospitalId,
        role: userType,
        acceptedTAndC,
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({ error: "OTP verification failed" });
    }
  },

  async resendOTP(req, res) {
    const { email } = req.body;

    const transaction = await sequelize.transaction();
    try {
      let user, userType, acceptedTAndC, hospitalId;

      user = await Doctor.findOne({
        where: { email },
        attributes: ["id", "acceptedTAndC", "email"],
        transaction,
      });
      if (user) {
        userType = "doctor";
        acceptedTAndC = user.acceptedTAndC;
        hospitalId = user.id;
      }

      if (!user) {
        user = await Receptionist.findOne({
          where: { email },
          attributes: ["id", "email", "doctorId"],
          transaction,
        });
        if (user) {
          userType = "receptionist";
          hospitalId = user.doctorId;
        }
      }

      if (!user) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "User not found" });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otp = otp;
      user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
      await user.save({ transaction });

      const otpMailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: "Your Login OTP",
        html: `<p>Your OTP for login is <b>${otp}</b>. It will expire in 5 minutes.</p>`,
      };

      await transporter.sendMail(otpMailOptions);

      await AuditLog.create(
        {
          action: constants.RESEND_OTP,
          details: `Resent OTP request by User ID: ${user.id}, email: ${user.email}`,
          hospitalId: hospitalId,
          receptionistId: userType === "receptionist" ? user.id : null,
          doctorId: userType === "doctor" ? user.id : null,
          role: userType,
          entity: userType === "doctor" ? "Doctor" : "Receptionist",
          status: "success",
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
          endpoint: req.url,
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "OTP resent successfully",
        hospitalId,
        role: userType,
        acceptedTAndC,
      });
    } catch (error) {
      if (transaction) await transaction.commit();
      return res.status(500).json({ error: "Failed to resend OTP" });
    }
  },

  async acceptTermsAndConditions(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const doctor = await Doctor.findOne({
        where: { id: req.user.id },
        attributes: ["id", "acceptedTAndC", "email"],
        transaction,
      });

      if (!doctor) {
        if (!transaction) await transaction.rollback();
        return res.status(404).json({ error: "Doctor not found" });
      }

      doctor.acceptedTAndC = true;

      await doctor.save();

      const payload = {
        id: doctor.id,
        email: doctor.email,
        role: "doctor",
        hospitalId: doctor.id,
        acceptedTAndC: doctor.acceptedTAndC,
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "1d",
      });

      await AuditLog.create(
        {
          action: constants.ACCEPT_TERMS_AND_CONDITIONS,
          details: `User (doctor)(ID: ${doctor.id}, Email: ${doctor.email}) accepted terms & conditions.`,
          hospitalId: doctor.id,
          receptionistId: null,
          doctorId: doctor.id,
          role: "doctor",
          token: req.header("Authorization").split(" ")[1],
          entity: "Doctor",
          entityId: doctor.id,
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      return res.status(200).json({
        message: "Terms and conditions accepted",
        token,
        hospitalId: doctor.id,
        role: "doctor",
        acceptedTAndC: true,
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({
        error: "Failed to retrieve appointments",
      });
    }
  },

  async forgotPassword(req, res) {
    const { email } = req.body;

    const transaction = await sequelize.transaction();
    try {
      let user;
      let userType;

      user = await Doctor.findOne({ where: { email }, transaction });
      if (user) {
        userType = "doctor";
      }

      if (!user) {
        user = await Receptionist.findOne({
          where: { email },
          attributes: ["id", "email", "doctorId"],
          transaction,
        });
        if (user) {
          userType = "receptionist";
        }
      }

      if (!user) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "User not found" });
      }

      const resetToken = jwt.sign(
        { id: user.id, email: user.email, role: userType },
        process.env.JWT_SECRET,
        {
          expiresIn: "1h",
        }
      );

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "Password Reset Request",
        html: `<p>You requested for a password reset. Click <a href="${process.env.CLIENT_URL}/reset-password/${resetToken}">here</a> to reset your password. The link will expire in 1 hour.</p>`,
      };

      await transporter.sendMail(mailOptions);

      await AuditLog.create(
        {
          action: constants.FORGOT_PASSWORD,
          details: `User (ID: ${user.id}, Email: ${user.email}) requested a password reset.`,
          hospitalId: userType === "doctor" ? user.id : user.doctorId,
          receptionistId: userType === "receptionist" ? user.id : null,
          doctorId: userType === "doctor" ? user.id : null,
          role: userType,
          entity: userType === "doctor" ? "Doctor" : "Receptionist",
          entityId: user.id,
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
        .json({ message: "Password reset email sent successfully." });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({ error: "Error in sending email" });
    }
  },

  async resetPassword(req, res) {
    const { token, newPassword } = req.body;

    const transaction = await sequelize.transaction();
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      let user;

      if (decoded.role === "doctor") {
        user = await Doctor.findOne({
          where: { id: decoded.id },
          attributes: ["id"],
          transaction,
        });
      } else {
        user = await Receptionist.findOne({
          where: { id: decoded.id },
          attributes: ["id", "doctorId"],
          transaction,
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await user.update(
        { password: hashedPassword },
        { where: { id: user.id }, transaction }
      );

      await AuditLog.create(
        {
          action: constants.RESET_PASSWORD,
          details: `User (ID: ${user.id}, Email: ${user.email}) resets the password.`,
          hospitalId: decoded.role === "doctor" ? user.id : user.doctorId,
          receptionistId: decoded.role === "receptionist" ? user.id : null,
          doctorId: decoded.role === "doctor" ? user.id : null,
          role: decoded.role,
          token,
          entity: decoded.role === "doctor" ? "Doctor" : "Receptionist",
          entityId: decoded.id,
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(200).json({ message: "Password reset successfully!" });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({ error: "Invalid or expired token." });
    }
  },

  async setFees(req, res) {
    const { feesFor, fees } = req.body;

    if (!feesFor) {
      return res.status(400).json({ error: "Type is required" });
    }

    if (!fees) {
      return res.status(400).json({ error: "Fees cannot be empty" });
    }

    if (isNaN(fees)) {
      return res.status(400).json({ error: "Fees must be a valid number" });
    }

    const feesValue = parseFloat(fees);
    if (feesValue <= 0) {
      return res.status(400).json({ error: "Fees must be a positive value" });
    }

    const transaction = await sequelize.transaction();
    try {
      const doctor = await Doctor.findOne({
        where: { id: req.user.id },
        attributes: ["id", "email"],
        transaction,
      });

      if (!doctor) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Doctor not found" });
      }

      const existingFee = await SetFee.findOne({
        where: { doctorId: doctor.id, feesFor },
        transaction,
      });

      let updatedFee,
        oldFees = {
          feesFor,
          fees: null,
        };
      if (existingFee) {
        oldFees.fees = existingFee.fees;
        existingFee.fees = feesValue;
        await existingFee.save();
        updatedFee = existingFee;
      } else {
        updatedFee = await SetFee.create({
          feesFor,
          fees: feesValue,
          doctorId: doctor.id,
          transaction,
        });
      }

      await AuditLog.create(
        {
          action: existingFee ? constants.UPDATE_FEE : constants.ADD_FEE,
          details: `User (ID: ${doctor.id}, Email: ${doctor.email}) ${
            existingFee ? "Updated" : "Added"
          } fee for ${feesFor}.`,
          hospitalId: doctor.id,
          receptionistId: null,
          doctorId: doctor.id,
          role: "doctor",
          token: req.header("Authorization").split(" ")[1],
          entity: "SetFee",
          entityId: updatedFee.id,
          newValue: { feesFor, fees },
          oldValue: oldFees,
          status: "success",
          endpoint: req.url,
          module: "Fee Management",
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(201).json({
        message: existingFee
          ? "Fees updated successfully!"
          : "Fees added successfully!",
        data: updatedFee,
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error(error);
      return res.status(500).json({ error: "Failed to set fee" });
    }
  },

  async getFees(req, res) {
    if (!req.user || req.user.role !== "doctor") {
      return res.status(401).json({ error: "Unauthorized request" }); // Unauthorized
    }

    try {
      const doctor = await Doctor.findByPk(req.user.id, {
        attributes: ["id"],
      });
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      const feesList = await SetFee.findAll({
        where: { doctorId: doctor.id },
        order: [["createdAt", "DESC"]],
        attributes: ["id", "feesFor", "fees"],
      });

      res.status(200).json({
        message: "Fees fetched successfully!",
        data: feesList,
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to get fees" });
    }
  },

  async deleteFees(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;

      const doctor = await Doctor.findOne({
        where: { id: req.user.id },
        attributes: ["id", "email"],
        transaction,
      });

      if (!doctor) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Doctor not found" });
      }

      const fee = await SetFee.findOne({
        where: { id, doctorId: doctor.id },
        transaction,
      });

      if (!fee) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Fee record not found" });
      }

      await fee.destroy({ transaction });

      await AuditLog.create(
        {
          action: constants.DELETE_FEE,
          details: `User (ID: ${doctor.id}, email: ${doctor.email}) deleted the (${fee.feesFor}) fee`,
          hospitalId: doctor.id,
          receptionistId: null,
          doctorId: doctor.id,
          role: "doctor",
          token: req.header("Authorization").split(" ")[1],
          entity: "SetFee",
          entityId: id,
          module: "Fee Management",
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(200).json({
        message: "Fees deleted successfully!",
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({ error: "Failed to delete fees" });
    }
  },

  async changePassword(req, res) {
    const { oldPassword, newPassword } = req.body;

    const transaction = await sequelize.transaction();
    try {
      const doctor = await Doctor.findByPk(req.user.id, {
        attributes: ["id", "password", "email"],
        transaction,
      });

      if (!doctor) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Doctor not found" });
      }

      const isValidPassword = await bcrypt.compare(
        oldPassword,
        doctor.password
      );

      if (!isValidPassword) {
        if (transaction) await transaction.rollback();
        return res.status(401).json({ error: "Invalid old password" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      doctor.password = hashedPassword;

      await doctor.save({ transaction });

      await AuditLog.create(
        {
          action: constants.CHANGE_PASSWORD,
          details: `User (ID: ${doctor.id}, Email: ${doctor.email}) changed a password.`,
          hospitalId: doctor.id,
          receptionistId: null,
          doctorId: doctor.id,
          role: req.user.role,
          token: req.header("Authorization").split(" ")[1],
          endpoint: req.url,
          status: "success",
          entity: "Doctor",
          entityId: doctor.id,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({ error: "Failed to change password" });
    }
  },

  async paymentScanner(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const transaction = await sequelize.transaction();
    try {
      const doctor = await Doctor.findByPk(req.user.hospitalId, {
        attributes: ["id", "paymentQr", "qrContentType", "email"],
        transaction,
      });

      const updated = doctor.paymentQr ? true : false;

      doctor.paymentQr = req.file.buffer;
      doctor.qrContentType = req.file.mimetype;

      await doctor.save({ transaction });

      await AuditLog.create(
        {
          action: updated
            ? constants.UPDATE_PAYMENT_QR
            : constants.ADD_PAYMENT_QR,
          details: `User (ID: ${req.user.id}, Email: ${req.user.email}) ${
            updated ? "updated" : "added"
          } payment QR.`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization").split(" ")[1],
          entity: "Doctor",
          entityId: doctor.id,
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      res.status(200).json({
        message: "Payment QR updated successfully",
        paymentQr: doctor.paymentQr,
        qrContentType: doctor.qrContentType,
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({
        error: "Failed to upload payment QR",
      });
    }
  },

  async addSignature(req, res) {
    if (!req.user || req.user.role !== "doctor") {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const transaction = await sequelize.transaction();
    try {
      const doctor = await Doctor.findByPk(req.user.id, {
        attributes: ["id", "signature", "signatureContentType", "email"],
        transaction,
      });

      let updated = doctor.signature ? true : false;
      doctor.signature = `data:${
        req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;

      await doctor.save({ transaction });

      await AuditLog.create(
        {
          action: updated
            ? constants.UPDATE_SIGNATURE
            : constants.ADD_SIGNATURE,
          details: `User (ID: ${req.user.id}, Email: ${req.user.email}) ${
            updated ? "updated" : "added"
          } signature.`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization").split(" ")[1],
          entity: "Doctor",
          entityId: doctor.id,
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      res.status(200).json({
        message: "Signature added successfully",
        signature: `data:${req.file.mimetype};base64,${req.file.buffer.toString(
          "base64"
        )}`,
      });
    } catch (error) {
      if (transaction) await transaction.commit();
      return res.status(500).json({ error: "Failed to upload signature" });
    }
  },

  async addLogo(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const transaction = await sequelize.transaction();
    try {
      const doctor = await Doctor.findByPk(req.user.id, {
        attributes: ["id", "logo", "logoContentType", "email"],
        transaction,
      });

      const updated = doctor.logo ? true : false;
      doctor.logo = `data:${
        req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;

      await doctor.save({ transaction });

      await AuditLog.create(
        {
          action: updated ? constants.UPDATE_LOGO : constants.ADD_LOGO,
          details: `User (ID: ${req.user.id}, Email: ${req.user.email}) ${
            updated ? "updated" : "added"
          } logo.`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization").split(" ")[1],
          entity: "Doctor",
          entityId: doctor.id,
          endpoint: req.url,
          status: "success",
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      res.status(200).json({
        message: "Logo added successfully",
        logo: `data:${req.file.mimetype};base64,${req.file.buffer.toString(
          "base64"
        )}`,
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({ error: "Failed to upload logo" });
    }
  },

  async setCheckInOutTime(req, res) {
    if (!req.user || req.user.role !== "doctor") {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const doctorId = req.user.id;
    const { checkInTime, checkOutTime } = req.body;
    if (!checkInTime && !checkOutTime) {
      return res.status(400).json({
        error: "Please provide atleast one of checkInTime or checkOutTime",
      });
    }

    const transaction = await sequelize.transaction();
    try {
      const doctor = await Doctor.findOne({
        where: { id: doctorId },
        attributes: ["id", "checkInTime", "checkOutTime", "email"],
        transaction,
      });
      if (!doctor) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Doctor not found" });
      }

      const updated = doctor.checkInTime ? true : false;

      await doctor.update(
        {
          checkInTime: checkInTime || null,
          checkOutTime: checkOutTime || null,
        },
        {
          transaction,
        }
      );

      await AuditLog.create(
        {
          action: updated
            ? constants.UPDATE_CHECK_IN_OUT_TINE
            : constants.ADD_CHECK_IN_OUT_TINE,
          details: `User (ID: ${req.user.id}, Email: ${req.user.email}) ${
            updated ? "updated" : "added"
          } check in/out time.`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.role : null,
          role: req.user.role,
          token: req.header("Authorization").split(" ")[1],
          endpoint: req.url,
          status: "success",
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(200).json({
        message: "Check-in and check-out times updated successfully!",
        doctor: {
          doctorId: doctor.doctorId,
          checkInTime: doctor.checkInTime,
          checkOutTime: doctor.checkOutTime,
        },
      });
    } catch (error) {
      if (transaction) await transaction.commit();
      return res.status(500).json({
        error: "Failed to set check-in and check-out times",
      });
    }
  },

  async getCheckInCheckOutTime(req, res) {
    if (!req.user || req.user.role !== "doctor") {
      return res.status(401).json({ error: "Unauthorized request" });
    }
    const doctorId = req.user.id;
    try {
      const doctor = await Doctor.findOne({ where: { id: doctorId } });
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }
      return res.status(200).json({
        checkInTime: doctor?.checkInTime,
        checkOutTime: doctor?.checkOutTime,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to set check-in and check-out times",
      });
    }
  },

  async getPaymentScanner(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    try {
      const doctor = await Doctor.findByPk(req.user.hospitalId);

      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      res.status(200).json({
        paymentQr: doctor.paymentQr,
        qrContentType: doctor.qrContentType,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to get payment scanner.",
      });
    }
  },

  async getSignature(req, res) {
    if (!req.user || req.user.role !== "doctor") {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    try {
      const doctor = await Doctor.findByPk(req.user.id, {
        attributes: ["id", "signature"],
      });

      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      res.status(200).json({
        signature: getDecryptedDocumentAsBase64(doctor.signature),
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to get signature" });
    }
  },

  async getLogo(req, res) {
    if (!req.user || req.user.role !== "doctor") {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    try {
      const doctor = await Doctor.findByPk(req.user.id, {
        attributes: ["id", "logo"],
      });

      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      res.status(200).json({
        logo: getDecryptedDocumentAsBase64(doctor.logo),
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to get logo" });
    }
  },

  async editDoctor(req, res) {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized request" });
    }
    const doctorId = req.user.id;
    const {
      name,
      clinicName,
      mobileNumber,
      address,
      dateOfBirth,
      gender,
      medicalLicenceNumber,
      medicalDegree,
      specialization,
      alternateContactNo,
      experience,
      clinicAddress,
    } = req.body;

    const transaction = await sequelize.transaction();
    try {
      const doctor = await Doctor.findOne({
        attributes: [
          "id",
          "name",
          "email",
          "clinicName",
          "mobileNumber",
          "address",
          "dateOfBirth",
          "gender",
          "medicalLicenceNumber",
          "medicalDegree",
          "specialization",
          "alternateContactNo",
          "experience",
          "clinicAddress",
        ],
        where: { id: doctorId },
        transaction,
      });

      if (!doctor) {
        await transaction.rollback();
        return res.status(404).json({ error: "Doctor not found" });
      }

      const {
        name: oldName,
        mobileNumber: oldMobileNuber,
        address: oldAddress,
        dateOfBirth: oldDateOfBirth,
        medicalLicenceNumber: oldMedicalLicenceNumber,
        specialization: oldSpecialization,
        alternateContactNo: oldAlternateContactNo,
        clinicName: oldClinicName,
        gender: oldGender,
        medicalDegree: oldMedicalDegree,
        experience: oldExperience,
        clinicAddress: oldClinicAddress,
      } = { ...doctor.toJSON() };

      await doctor.update(
        {
          name: name || doctor.name,
          clinicName: clinicName || doctor.clinicName,
          mobileNumber: mobileNumber || doctor.mobileNumber,
          address: address || doctor.address,
          dateOfBirth: dateOfBirth || doctor.dateOfBirth,
          gender: gender || doctor.gender,
          medicalLicenceNumber:
            medicalLicenceNumber || doctor.medicalLicenceNumber,

          medicalDegree: medicalDegree || doctor.medicalDegree,
          specialization: specialization || doctor.specialization,
          alternateContactNo: alternateContactNo || doctor.alternateContactNo,
          experience: experience || doctor.experience,
          clinicAddress: clinicAddress || doctor.clinicAddress,
        },
        {
          where: { id: doctorId },
          transaction,
        }
      );

      await AuditLog.create(
        {
          action: constants.UPDATE_DOCTOR,
          details: `User (ID: ${req.user.id}, Email: ${req.user.email}) updated the doctor(${doctor.id}) information.`,
          hospitalId: req.user.hospitalId,
          receptionistId: null,
          doctorId: doctor.id,
          role: "doctor",
          token: req.header("Authorization").split(" ")[1],
          endpoint: req.url,
          status: "success",
          entity: "Doctor",
          entityId: doctor.id,
          newValue: {
            ...maskData({
              name,
              mobileNumber,
              address,
              dateOfBirth,
              medicalLicenceNumber,
              specialization,
              alternateContactNo,
            }),
            clinicName,
            gender,
            medicalDegree,
            experience,
            clinicAddress,
          },
          oldValue: {
            ...maskData({
              name: oldName,
              mobileNumber: oldMobileNuber,
              address: oldAddress,
              dateOfBirth: oldDateOfBirth,
              medicalLicenceNumber: oldMedicalLicenceNumber,
              specialization: oldSpecialization,
              alternateContactNo: oldAlternateContactNo,
            }),
            clinicName: oldClinicName,
            gender: oldGender,
            medicalDegree: oldMedicalDegree,
            experience: oldExperience,
            clinicAddress: oldClinicAddress,
          },
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();
      return res.status(200).json({
        message: "Doctor information updated successfully!",
        doctorId: doctor.doctorId,
      });
    } catch (error) {
      console.log(error);

      await transaction.rollback();
      return res.status(500).json({
        error: "Failed to update doctor information",
      });
    }
  },

  async removeDoctor(req, res) {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized request" });
    }
    const doctorId = req.user.id;

    const transaction = await sequelize.transaction();
    try {
      const doctor = await Doctor.findOne({
        where: { id: doctorId },
        transaction,
      });
      if (!doctor) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Doctor not found" });
      }

      await doctor.destroy({ transaction });

      await transaction.commit();
      return res.status(200).json({ message: "Doctor removed successfully!" });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({
        error: "Failed to remove doctor",
      });
    }
  },

  async getDoctor(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    try {
      const doctor = await Doctor.findByPk(req.user.hospitalId);

      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      doctor.password = "";

      let doctorData = doctor.toJSON();

      if (doctorData.signature) {
        doctorData.signature = getDecryptedDocumentAsBase64(
          doctorData.signature
        );
      }

      if (doctorData.logo) {
        doctorData.logo = getDecryptedDocumentAsBase64(doctorData.logo);
      }

      await AuditLog.create({
        action: constants.GET_DOCTOR,
        hospitalId: req.user.hospitalId,
        receptionistId: req.user.role === "receptionist" ? req.user.id : null,
        doctorId: req.user.role === "doctor" ? req.user.id : null,
        role: req.user.role,
        token: req.header("Authorization").split(" ")[1],
        endpoint: req.url,
        status: "success",
        entity: "Doctor",
        entityId: doctor.id,
        endpoint: req.url,
        ipAddress: req.clientIp,
        userAgent: req.headers["user-agent"],
      });

      return res.status(200).json({ doctor: doctorData });
    } catch (error) {
      return res.status(500).json({ error: "Failed to get doctor" });
    }
  },

  async getAppointmentStatisticsByDoctor(req, res) {
    const doctorId = req.user.hospitalId;

    try {
      const totalAppointments = await Appointment.count({
        where: {
          date: {
            [Op.between]: [
              new Date().setHours(0, 0, 0, 0),
              new Date().setHours(23, 59, 59, 59),
            ],
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

      const totalCompletedAppointments = await Appointment.count({
        include: [
          {
            model: Patient,
            as: "patient",
            where: { doctorId },
          },
        ],
        where: {
          status: {
            [Op.in]: ["in", "out"],
          },
          date: {
            [Op.between]: [
              new Date().setHours(0, 0, 0, 0),
              new Date().setHours(23, 59, 59, 59),
            ],
          },
        },
      });

      const totalPendingAppointments = await Appointment.count({
        include: [
          {
            model: Patient,
            as: "patient",
            where: { doctorId },
          },
        ],
        where: {
          status: {
            [Op.is]: null, // Status is null
          },
          date: {
            [Op.between]: [
              new Date().setHours(0, 0, 0, 0), // Start of the day
              new Date().setHours(23, 59, 59, 59), // End of the day
            ],
          },
        },
      });

      return res.status(200).json({
        stats: {
          totalAppointments,
          totalCompletedAppointments,
          totalPendingAppointments,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to get appointments stats",
      });
    }
  },

  async getAgeGroupCounts(req, res) {
    if (!req.user || req.user.role !== "doctor") {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const { month, year } = req.query;

    const currentMonth = month || moment().month() + 1;
    const currentYear = year || moment().year();

    try {
      const startOfMonth = moment(
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

      const ageGroupCounts = await Appointment.findAll({
        where: {
          date: {
            [Op.between]: [startOfMonth, endOfMonth],
          },
        },
        include: [
          {
            model: Patient,
            as: "patient",
            attributes: ["age"],
            where: {
              doctorId: req.user.id,
            },
          },
        ],
        attributes: ["id"],
      });

      const youngCount = ageGroupCounts.filter(
        (appointment) => appointment.patient.age <= 17
      ).length;
      const adultCount = ageGroupCounts.filter(
        (appointment) =>
          appointment.patient.age >= 18 && appointment.patient.age <= 49
      ).length;
      const seniorCount = ageGroupCounts.filter(
        (appointment) => appointment.patient.age >= 50
      ).length;

      return res.status(200).json({
        data: {
          youngCount,
          adultCount,
          seniorCount,
        },
      });
    } catch (error) {
      console.log(error);

      return res.status(500).json({
        error: "Failed to retrieve age group counts",
      });
    }
  },

  async getGenderPercentage(req, res) {
    if (!req.user || req.user.role !== "doctor") {
      return res.status(401).json({ error: "Unauthorized request" });
    }
    const { month, year } = req.query;

    const currentMonth = month || moment().month() + 1;
    const currentYear = year || moment().year();

    try {
      const startOfMonth = moment(
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

      const appointments = await Appointment.findAll({
        where: {
          date: {
            [Op.between]: [startOfMonth, endOfMonth],
          },
        },
        include: [
          {
            model: Patient,
            as: "patient",
            attributes: ["gender"],
            where: {
              doctorId: req.user.id,
            },
          },
        ],
      });

      const totalAppointments = appointments.length;

      const maleCount = appointments.filter(
        (appointment) => appointment.patient.gender === "male"
      ).length;
      const femaleCount = appointments.filter(
        (appointment) => appointment.patient.gender === "female"
      ).length;
      const otherCount = appointments.filter(
        (appointment) => appointment.patient.gender === "other"
      ).length;

      const malePercentage = totalAppointments
        ? ((maleCount / totalAppointments) * 100).toFixed(2)
        : 0;
      const femalePercentage = totalAppointments
        ? ((femaleCount / totalAppointments) * 100).toFixed(2)
        : 0;
      const otherPercentage = totalAppointments
        ? ((otherCount / totalAppointments) * 100).toFixed(2)
        : 0;

      return res.status(200).json({
        data: {
          malePercentage,
          femalePercentage,
          otherPercentage,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to retrieve gender percentages",
      });
    }
  },

  async getRevenueByMonth(req, res) {
    if (!req.user || req.user.role !== "doctor") {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const { month, year } = req.query;
    const currentMonth = month || moment().month() + 1;
    const currentYear = year || moment().year();

    try {
      const startOfMonth = moment(
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

      const feesRevenue = await Appointment.sum("fees", {
        where: {
          date: {
            [Op.between]: [startOfMonth, endOfMonth],
          },
          status: "out",
        },
        include: [
          {
            model: Patient,
            as: "patient",
            where: { doctorId: req.user.hospitalId },
            attributes: [],
          },
        ],
      });

      const extraChargeRevenue = await Appointment.sum("extraFees", {
        where: {
          date: {
            [Op.between]: [startOfMonth, endOfMonth],
          },
          status: "out",
        },
        include: [
          {
            model: Patient,
            as: "patient",
            where: { doctorId: req.user.hospitalId },
            attributes: [],
          },
        ],
      });

      return res
        .status(200)
        .json({ revenue: (feesRevenue || 0) + (extraChargeRevenue || 0) });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to calculate revenue",
      });
    }
  },

  async getRevenueByYear(req, res) {
    if (!req.user || req.user.role !== "doctor") {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const { year } = req.query;
    const currentYear = year || moment().year();

    try {
      const revenueByMonth = await Appointment.findAll({
        attributes: [
          [fn("MONTH", col("date")), "month"],
          [fn("SUM", col("fees")), "revenue"],
          [fn("SUM", col("extraFees")), "extraFeesRevenue"],
        ],
        where: {
          date: {
            [Op.between]: [
              new Date(`${currentYear}-01-01`),
              new Date(`${currentYear}-12-31`),
            ],
          },
          status: "out",
        },
        include: [
          {
            model: Patient,
            as: "patient",
            where: { doctorId: req.user.id },
            attributes: [],
          },
        ],
        group: [literal("MONTH(date)")],
        order: [[literal("MONTH(date)"), "ASC"]],
      });

      const monthlyRevenue = Array(12).fill(0);
      revenueByMonth.forEach((item) => {
        const monthIndex = item.dataValues.month - 1;
        monthlyRevenue[monthIndex] =
          parseFloat(item.dataValues.revenue || 0) +
          parseFloat(item.dataValues.extraFeesRevenue || 0);
      });

      return res.status(200).json({ year: currentYear, monthlyRevenue });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to calculate revenue by year",
      });
    }
  },

  async setClinicTime(req, res) {
    const doctorId = req.user.id;
    const { clinicStartTime, clinicEndTime, openDays, closedDays } = req.body;

    if (!clinicStartTime || !clinicEndTime) {
      return res.status(400).json({
        error: "Please provide Start Time and EndTime",
      });
    }

    const transaction = await sequelize.transaction();
    try {
      const doctor = await Doctor.findOne({
        where: { id: doctorId },
        attributes: [
          "id",
          "email",
          "clinicStartTime",
          "clinicEndTime",
          "openDays",
          "closedDays",
        ],
        transaction,
      });

      if (!doctor) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Doctor not found" });
      }

      const updated = doctor.clinicStartTime ? true : false;
      const oldValues = { ...doctor.toJSON() };

      if (clinicStartTime) doctor.clinicStartTime = clinicStartTime;
      if (clinicEndTime) doctor.clinicEndTime = clinicEndTime;
      if (openDays) doctor.openDays = openDays || [];
      if (closedDays) doctor.closedDays = closedDays || [];
      await doctor.save({ transaction });

      await AuditLog.create(
        {
          action: updated
            ? constants.UPDATE_CLINIC_START_END_TIME
            : constants.SET_CLINIC_START_END_TIME,
          details: `User (ID: ${doctor.id}, Email: ${doctor.email}) ${
            updated ? "updated" : "added"
          } clinic start/end time.`,
          newValue: { clinicStartTime, clinicEndTime, openDays, closedDays },
          oldValue: updated ? oldValues : null,
          hospitalId: doctor.id,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          role: req.user.role,
          entity: "Doctor",
          entityId: doctor.id,
          endpoint: req.url,
          status: "success",
          token: req.header("Authorization").split(" ")[1],
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(200).json({
        message: "Clinic timings updated successfully!",
        doctor: {
          id: doctor.id,
          clinicStartTime: doctor.clinicStartTime,
          clinicEndTime: doctor.clinicEndTime,
          openDays: doctor.openDays,
          closedDays: doctor.closedDays,
        },
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({
        error: "Failed to set clinic timings",
      });
    }
  },

  async getClinicTime(req, res) {
    try {
      const doctorId = req.user.id;

      const doctor = await Doctor.findOne({
        where: { id: doctorId },
        attributes: [
          "clinicStartTime",
          "clinicEndTime",
          "openDays",
          "closedDays",
        ],
      });

      if (!doctor) return res.status(404).json({ message: "Doctor not found" });

      return res.json({
        ...doctor.toJSON(),
      });
    } catch (error) {
      console.error("Error fetching clinic time:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  async setShifts(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const doctorId = req.user.id;
      const { shiftName, shiftStartTime, shiftEndTime } = req.body;

      if (!shiftStartTime || !shiftEndTime) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Shift Start and Shift End time are required" });
      }

      const existingShift = await Shift.findOne({
        where: { doctorId, shiftName },
        transaction,
      });

      if (existingShift) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Shift name already exists, please enter another name",
        });
      }

      const shift = await Shift.create(
        {
          doctorId,
          shiftName,
          shiftStartTime,
          shiftEndTime,
        },
        { transaction }
      );

      const shiftDataForAudit = {
        shiftId: shift.id,
        doctorId: doctorId,
        shiftName: shift.shiftName,
        shiftStartTime: shift.shiftStartTime,
        shiftEndTime: shift.shiftEndTime,
      };

      await AuditLog.create(
        {
          action: constants.CREATE_SHIFT_TIME,
          details: `Doctor ${req.user.name} created a new shift: ${shiftName}`,
          hospitalId: req.user.hospitalId,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization").split(" ")[1],
          entity: "Shift",
          entityId: shift.id,
          status: "success",
          endpoint: req.url,
          oldValue: null,
          newValue: shiftDataForAudit,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      return res
        .status(200)
        .json({ message: "Shift created successfully", shift });
    } catch (error) {
      return res.status(500).json({ error: "Failed to create shift" });
    }
  },

  async getShifts(req, res) {
    try {
      if (!req.user || req.user.role !== "doctor") {
        return res.status(401).json({ error: "Unauthorized request" });
      }

      const doctorId = req.user.id;

      const shifts = await Shift.findAll({
        where: { doctorId },
      });

      return res.status(200).json({
        data: shifts || [],
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch shifts" });
    }
  },

  async deleteShifts(req, res) {
    try {
      if (!req.user || req.user.role !== "doctor") {
        return res.status(401).json({ error: "Unauthorized request" });
      }

      const transaction = await sequelize.transaction();

      const doctorId = req.user.id;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: "Shift id is required" });
      }

      const shift = await Shift.findOne({
        where: { id, doctorId },
        transaction,
      });

      if (!shift) {
        await transaction.rollback();
        return res.status(404).json({ error: "Shift not found" });
      }

      const deletedShiftDataForAudit = {
        shiftId: shift.id,
        shiftName: shift.shiftName,
        shiftStartTime: shift.shiftStartTime,
        shiftEndTime: shift.shiftEndTime,
      };

      await shift.destroy({ transaction });

      await AuditLog.create(
        {
          action: "Delete Shift",
          details: `Doctor ${req.user.name} deleted shift ${shift.shiftName}`,
          hospitalId: req.user.hospitalId,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization").split(" ")[1],
          entity: "Shift",
          entityId: shift.id,
          status: "success",
          endpoint: req.url,
          oldValue: null,
          newValue: deletedShiftDataForAudit,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(200).json({
        message: "Shift deleted successfully",
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete shift" });
    }
  },

  async addSlot(req, res) {
    try {
      if (!req.user || req.user.role !== "doctor") {
        return res.status(401).json({ error: "Unauthorized request" });
      }

      const transaction = await sequelize.transaction();

      const doctorId = req.user.id;
      const { slotName, slotStartTime, slotEndTime } = req.body;

      if (!slotStartTime || !slotEndTime) {
        return res
          .status(400)
          .json({ error: "Start and End time are required" });
      }

      const existingSlot = await DoctorAvailability.findOne({
        where: { doctorId, slotName },
        transaction,
      });

      if (existingSlot) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Slot name already exist, please enter another name",
        });
      }

      const slot = await DoctorAvailability.create({
        doctorId,
        slotName,
        slotStartTime,
        slotEndTime,
      });

      const slotDataForAudit = {
        doctorId: doctorId,
        slotId: slot.id,
        slotName: slot.slotName,
        slotStartTime: slot.slotStartTime,
        slotEndTime: slot.slotEndTime,
      };

      await AuditLog.create(
        {
          action: "Create Slot",
          details: `Doctor ${req.user.name} create slot ${slot.slotName}`,
          hospitalId: req.user.hospitalId,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization").split(" ")[1],
          entity: "Slot",
          entityId: slot.id,
          status: "success",
          endpoint: req.url,
          oldValue: null,
          newValue: slotDataForAudit,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      return res
        .status(200)
        .json({ message: "Slot created successfully", slot });
    } catch (error) {
      return res.status(500).json({ error: "Failed to create slot" });
    }
  },

  async getSlots(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized request" });
      }

      let doctorId;

      if (req.user.role === "doctor") {
        doctorId = req.user.id;
      } else if (req.user.role === "receptionist") {
        doctorId = req.user.hospitalId;
        if (!doctorId) {
          return res
            .status(400)
            .json({ error: "Receptionist is not linked with doctor" });
        }
      } else {
        return res.status(403).json({ error: "Access denied" });
      }

      const slots = await DoctorAvailability.findAll({
        where: { doctorId },
      });

      return res.status(200).json({
        data: slots || [],
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch slots" });
    }
  },

  async deleteSlot(req, res) {
    try {
      if (!req.user || req.user.role !== "doctor") {
        return res.status(401).json({ error: "Unauthorized request" });
      }

      const transaction = await sequelize.transaction();

      const doctorId = req.user.id;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: "Slot id is required" });
      }

      const slot = await DoctorAvailability.findOne({
        where: { id, doctorId },
        transaction,
      });

      if (!slot) {
        await transaction.rollback();
        return res.status(404).json({ error: "Slot not found" });
      }

      const deletedSlotDataForAudit = {
        slotId: slot.id,
        slotName: slot.slotName,
        slotStartTime: slot.slotStartTime,
        slotEndTime: slot.slotEndTime,
      };

      await slot.destroy({ transaction });

      await AuditLog.create(
        {
          action: "Delete Slot",
          details: `Doctor ${req.user.name} deleted slot ${slot.slotName}`,
          hospitalId: req.user.hospitalId,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization").split(" ")[1],
          entity: "Slot",
          entityId: slot.id,
          status: "success",
          endpoint: req.url,
          oldValue: null,
          newValue: deletedSlotDataForAudit,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(200).json({
        message: "Slot deleted successfully",
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete slot" });
    }
  },

  async getRevenueSheet(req, res) {
    try {
      const { month, year, all } = req.query;

      const currentYear = Number(year) || moment().year();
      const currentMonth = Number(month) || moment().month() + 1;

      let startOf, endOf;

      if (all && all === "true") {
        startOf = moment().year(currentYear).startOf("year").toDate();
        endOf = moment().year(currentYear).endOf("year").toDate();
      } else {
        const baseDate = moment(
          `${currentYear}-${currentMonth}-01`,
          "YYYY-MM-DD"
        );
        startOf = baseDate.clone().startOf("month").toDate();
        endOf = baseDate.clone().endOf("month").toDate();
      }

      const appointments = await Appointment.findAll({
        where: {
          date: {
            [Op.between]: [startOf, endOf],
          },
          status: "out",
        },
        include: [
          {
            model: Patient,
            as: "patient",
            where: { doctorId: req.user.id },
            attributes: [
              "patientId",
              "name",
              "email",
              "mobileNumber",
              "address",
            ],
          },
        ],
      });

      if (appointments.length === 0) {
        return res.status(404).json({ message: "Data not found!" });
      }

      const data = appointments.map((patient) => ({
        patientId: patient.patient.patientId,
        name: decrypt(patient.patient.name),
        email: decrypt(patient.patient.email),
        mobileNumber: decrypt(patient.patient.mobileNumber),
        address: decrypt(patient.patient.address),
        charges: patient.fees || 0,
        extraCharges: patient.extraFees || 0,
      }));

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Clients");

      worksheet.columns = [
        { header: "Patient Unique Id", key: "patientId", width: 20 },
        { header: "Name", key: "name", width: 25 },
        { header: "Email", key: "email", width: 25 },
        { header: "Mobile No.", key: "mobileNumber", width: 20 },
        { header: "Address", key: "address", width: 20 },
        { header: "Charges", key: "charges", width: 20 },
        { header: "Extra charges", key: "extraCharges", width: 20 },
      ];

      data.forEach((patient) => {
        worksheet.addRow(patient);
      });

      const fileName = `patients_list.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Length", buffer.length);

      return res.send(buffer);
    } catch (error) {
      console.error("Error generating patient Excel:", error);
      if (!res.headersSent) {
        res
          .status(500)
          .json({ message: "Failed to generate patint list Excel file" });
      }
    }
  },
};

module.exports = doctorController;
