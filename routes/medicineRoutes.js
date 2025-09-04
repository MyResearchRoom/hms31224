const express = require("express");
const router = express.Router();

const medicineController = require("../controllers/medicineController.js");

const {
  validate,
  medicineValidationRule,
} = require("../middlewares/doctorValidator.js");
const authorize = require("../middlewares/authorize.js");
const { upload } = require("../middlewares/upload.js");


router.post(
  "/add",
  authorize,
  medicineValidationRule,
  validate,
  medicineController.addMedicine
);

router.get("/", authorize, medicineController.getAllMedicines);

router.put("/:id", authorize, medicineController.editMedicine);

router.delete("/:id", authorize, medicineController.deleteMedicine);

router.post("/addBulkMedicines", authorize, upload.single("excelFile"), medicineController.addBulkMedicinesFromExcel);

module.exports = router;
