const express = require("express");
const router = express.Router();

const appointmentController = require("../controllers/appointmentController.js");
const authorize = require("../middlewares/authorize");
const { upload } = require("../middlewares/upload.js");

router.post(
  "/extra-charges/:id",
  authorize,
  appointmentController.addExtraCharges
);

router.post(
  "/payment-mode/:id",
  authorize,
  appointmentController.addPaymentMode
);

router.post(
  "/prescription/:id",
  authorize,
  upload.single("prescription"),
  appointmentController.addPrescription
);

router.put("/parameters/:id", authorize, appointmentController.addParameters);

router.post(
  "/submit-prescription/:id",
  authorize,
  appointmentController.submitPrescription
);

router.put(
  "/submit-appointment/:id",
  authorize,
  appointmentController.submitAppointment
);

router.get(
  "/todays-appointments",
  authorize,
  appointmentController.getTodaysAppointments
);

router.get(
  "/patient-appointments/:id",
  authorize,
  appointmentController.getPatientAppointments
);

router.put(
  "/set-current-appointment/:id",
  authorize,
  appointmentController.setAppointmentStatus
);

router.get(
  "/current-appointment",
  authorize,
  appointmentController.getFirstAppointment
);

module.exports = router;
