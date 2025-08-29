const { Notification } = require("../models");

exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const doctorId = req.user.id;

    const { rows, count } = await Notification.findAndCountAll({
      where: { doctorId },
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
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
    console.error("Error fetching notifications:", error);
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


    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
