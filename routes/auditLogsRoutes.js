const express = require("express");
const {
  getAuditLogs,
  getLoginAuditLogs,
  deleteAuditLog,
} = require("../controllers/auditLogsController");

const router = express.Router();
const authorize = require("../middlewares/authorize");

router.get("/", authorize, getAuditLogs);

router.get("/login/logs", authorize, getLoginAuditLogs);

router.get("/:id", authorize, deleteAuditLog);

module.exports = router;
