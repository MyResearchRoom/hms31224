const { Op } = require("sequelize");
const { Notification, AuditLog } = require("../models");
const moment = require("moment-timezone");
const constants = require("../utils/constants");

exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 10, date } = req.query;
    const offset = (page - 1) * limit;
    const doctorId = req.user.id;
    const whereClause = {
      doctorId,
      createdAt: {
        [Op.between]: [
          moment(date).tz("Asia/Kolkata").startOf("day").toDate(),
          moment(date).tz("Asia/Kolkata").endOf("day").toDate(),
        ],
      },
    };

    const { rows, count } = await Notification.findAndCountAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    await AuditLog.create({
      action: constants.GET_NOTIFICATIONS,
      details: `Doctor ${req.user?.name || req.user?.id} fetched notifications`,
      hospitalId: req.user?.hospitalId,
      doctorId: req.user?.role === "doctor" ? req.user.id : null,
      receptionistId: req.user?.role === "receptionist" ? req.user.id : null,
      role: req.user?.role,
      token: req.header("Authorization")?.split(" ")[1],
      entity: "Notification",
      entityId: null,
      oldValue: null,
      newValue: rows,
      status: "success",
      endpoint: req.url,
      ipAddress: req.clientIp,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({
      success: true,
      data: {
        data: rows,
        pagination: {
          totalRecords: count,
          totalPages: Math.ceil(count / limit),
          currentPage: parseInt(page),
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.user.id;

    const notification = await Notification.findOne({
      where: { id, doctorId },
    });

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    notification.isRead = true;
    await notification.save();

    await AuditLog.create({
      action: constants.MARK_NOTIFICATION_READ,
      details: `Doctor ${req.user?.name || req.user?.id} marked notification ${id} as read`,
      hospitalId: req.user?.hospitalId,
      doctorId: req.user?.role === "doctor" ? req.user.id : null,
      receptionistId: req.user?.role === "receptionist" ? req.user.id : null,
      role: req.user.role,
      token: req.header("Authorization")?.split(" ")[1],
      entity: "Notification",
      entityId: notification.id,
      status: "success",
      endpoint: req.url,
      ipAddress: req.clientIp,
      userAgent: req.headers["user-agent"],
    })

    res
      .status(200)
      .json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.user.id;

    const notification = await Notification.findOne({
      where: { id, doctorId },
    });

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    await notification.destroy();

    await AuditLog.create({
      action: constants.DELETE_NOTIFICATION,
      details: `Doctor ${req.user?.name || req.user?.id} deleted notification ${id}`,
      hospitalId: req.user?.hospitalId,
      doctorId: req.user?.role === "doctor" ? req.user.id : null,
      receptionistId: req.user?.role === "receptionist" ? req.user.id : null,
      role: req.user.role,
      token: req.header("Authorization")?.split(" ")[1],
      entity: "Notification",
      entityId: notification.id,
      status: "success",
      endpoint: req.url,
      ipAddress: req.clientIp,
      userAgent: req.headers["user-agent"],
    })

    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.getNotificationsCount = async (req, res) => {
  try {
    const count = await Notification.count({
      where: {
        doctorId: req.user.id,
        isRead: false,
        createdAt: {
          [Op.between]: [
            moment().tz("Asia/Kolkata").startOf("day").toDate(),
            moment().tz("Asia/Kolkata").endOf("day").toDate(),
          ],
        },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        count,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications count:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
