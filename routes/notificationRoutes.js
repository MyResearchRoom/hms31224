const express = require("express");
const { getNotifications, markAsRead, deleteNotification, getNotificationsCount } = require("../controllers/notificationController");
const authorize = require("../middlewares/authorize");
const router = express.Router();

router.get("/", authorize, getNotifications);
router.patch("/:id/read", authorize, markAsRead);
router.delete("/:id", authorize, deleteNotification);
router.get("/count", authorize, getNotificationsCount);

module.exports = router;
