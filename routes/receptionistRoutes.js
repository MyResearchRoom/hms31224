const express = require("express");
const router = express.Router();

const {
  validate,
  receptionistRegistrationValidationRules,
} = require("../middlewares/doctorValidator");
const authorize = require("../middlewares/authorize.js");

const receptionistController = require("../controllers/receptionistController");
const { upload } = require("../middlewares/upload");

router.post(
  "/register",
  upload.fields([{ name: "profile" }, { name: "documents[]" }]),
  receptionistRegistrationValidationRules,
  validate,
  authorize,
  receptionistController.addReceptionist
);

router.put(
  "/:id",
  upload.fields([{ name: "profile" }, { name: "documents[]" }]),
  authorize,
  receptionistController.editReceptionist
);

router.delete("/:id", authorize, receptionistController.removeReceptionist);

router.get("/", authorize, receptionistController.getAllReceptionists);

router.get("/me", authorize, receptionistController.getMe);

router.post(
  "/change-profile",
  authorize,
  upload.single("profile"),
  receptionistController.changeProfile
);

router.post(
  "/change-password/:id",
  authorize,
  receptionistController.changePassword
);

router.get("/:id", authorize, receptionistController.getReceptionistById);

router.post("/check-in", authorize, receptionistController.checkIn);

router.post("/check-out", authorize, receptionistController.checkOut);

router.get(
  "/stats/:id",
  authorize,
  receptionistController.getReceptionistAttendanceStats
);

router.get(
  "/attendance/history",
  authorize,
  receptionistController.getAttendanceHistoryByMonth
);

router.get(
  "/attendance-history/:id",
  authorize,
  receptionistController.getAttendanceHistoryByMonth
);

module.exports = router;
