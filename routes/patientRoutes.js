const express = require("express");
const router = express.Router();

const patientController = require("../controllers/patientController.js");

const {
  patientRegistrationValidationRule,
  validate,
  patientAppointmentValidationRule,
} = require("../middlewares/doctorValidator.js");
const authorize = require("../middlewares/authorize.js");

router.post(
  "/register",
  authorize,
  patientRegistrationValidationRule,
  validate,
  patientController.addPatient
);

router.post(
  "/appointment/:id",
  authorize,
  patientAppointmentValidationRule,
  validate,
  patientController.bookAppointment
);

router.get("/patients", authorize, patientController.getPatients);

router.get(
  "/patients-for-appointment",
  authorize,
  patientController.getPatientsForAppointment
);

router.put("/update-toxicity/:id", authorize, patientController.setToxicity);

router.get("/getCounts", authorize, patientController.getPatientsCount);
router.get(
  "/count/all-time",
  authorize,
  patientController.getAllTimePatientCount
);

module.exports = router;
