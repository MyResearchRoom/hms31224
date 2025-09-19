const { AuditLog, Receptionist, Doctor } = require("../models");
const { Op } = require("sequelize");
const constants = require("../utils/constants");

exports.getAuditLogs = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = { hospitalId: req.user.hospitalId };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt[Op.gte] = new Date(startDate);
      if (endDate) query.createdAt[Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;

    const { rows: auditLogs, count: total } = await AuditLog.findAndCountAll({
      where: query,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    await AuditLog.create({
      action: constants.GET_AUDIT_LOGS,
      hospitalId: req.user.hospitalId,
      receptionistId: req.user.role === "receptionist" ? req.user.id : null,
      doctorId: req.user.role === "doctor" ? req.user.id : null,
      role: req.user.role,
      token: req.header("Authorization")?.split(" ")[1],
      entity: "AuditLog",
      status: "success",
      module: "Auditlog Management",
      status: "success",
      endpoint: req.url,
      ipAddress: req.clientIp,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / limit),
      pageSize: parseInt(limit, 10),
      data: auditLogs,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getLoginAuditLogs = async (req, res) => {
  try {
    const { date, page = 1, limit = 20 } = req.query;

    const whereClause = {
      hospitalId: req.user.hospitalId,
      action: constants.VERIFY_OTP,
    };

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      whereClause.createdAt = { [Op.between]: [startOfDay, endOfDay] };
    } else {
      const now = new Date();
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0
      );
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );

      whereClause.createdAt = { [Op.between]: [startOfMonth, endOfMonth] };
    }

    const offset = (page - 1) * limit;

    const { rows: auditLogs, count: total } = await AuditLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Doctor,
          as: "doctor",
          attributes: ["id", "name", "doctorId"],
        },
        {
          model: Receptionist,
          as: "receptionist",
          attributes: ["id", "name", "receptionistId"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    const data = auditLogs.map((item) => ({
      ...item.toJSON(),
      user: item.doctor
        ? {
            ...item.doctor.toJSON(),
            id: item.doctor.doctorId,
          }
        : {
            ...item.receptionist.toJSON(),
            id: item.receptionist.receptionistId,
          },
      doctorId: null,
      receptionistId: null,
    }));

    await AuditLog.create({
      action: constants.GET_LOGIN_AUDIT_LOGS,
      hospitalId: req.user.hospitalId,
      receptionistId: req.user.role === "receptionist" ? req.user.id : null,
      doctorId: req.user.role === "doctor" ? req.user.id : null,
      role: req.user.role,
      token: req.header("Authorization")?.split(" ")[1],
      entity: "AuditLog",
      status: "success",
      module: "Auditlog Management",
      status: "success",
      endpoint: req.url,
      ipAddress: req.clientIp,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / limit),
      pageSize: parseInt(limit, 10),
      data,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteAuditLog = async (req, res) => {
  try {
    const deletedCount = await AuditLog.destroy({
      where: {
        id: req.params.id,
        hospitalId: req.user.hospitalId,
      },
    });

    if (deletedCount === 0) {
      return res.status(404).json({ error: "Log not found" });
    }

    await AuditLog.create({
      action: constants.DELETE_AUDIT_LOG,
      details: `Deleted audit log Id: ${req.params.id}`,
      hospitalId: req.user.hospitalId,
      receptionistId: req.user.role === "receptionist" ? req.user.id : null,
      doctorId: req.user.role === "doctor" ? req.user.id : null,
      role: req.user.role,
      token: req.header("Authorization")?.split(" ")[1],
      entity: "AuditLog",
      entityId: req.params.id,
      status: "success",
      module: "Auditlog Management",
      status: "success",
      endpoint: req.url,
      ipAddress: req.clientIp,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({
      message: "Log deleted successfully",
      id: req.params.id,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete log." });
  }
};
