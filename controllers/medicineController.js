const { Op } = require("sequelize");
const { Medicine } = require("../models");
const xlsx = require("xlsx");

const medicineController = {
  async addMedicine(req, res) {
    if (!req.user || req.user.role !== "receptionist") {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const { name, strength, form, category, brand } = req.body;

    try {
      const medicineWithName = await Medicine.findOne({
        where: { name, strength, form, brand },
      });

      if (medicineWithName) {
        return res
          .status(400)
          .json({ error: "Medicine with same specifications already exists" });
      }

      const medicine = await Medicine.create({
        name,
        strength,
        form,
        category,
        brand,
        doctorId: req.user.hospitalId,
      });

      res
        .status(200)
        .json({ message: "Medicine added successfully", medicine });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to add medicine", details: error.message });
    }
  },

  async getAllMedicines(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const searchTerm = req.query.searchTerm;

    try {
      let whereClause = { doctorId: req.user.hospitalId };
      if (searchTerm) {
        whereClause.name = {
          [Op.like]: `%${searchTerm}%`,
        };
      }

      const medicines = await Medicine.findAll({
        where: whereClause,
        order: [["name", "ASC"]],
      });
      res.status(200).json({ medicines });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to get medicines", details: error.message });
    }
  },

  async editMedicine(req, res) {
    if (!req.user || req.user.role !== "receptionist") {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const { id } = req.params; // Medicine ID to be updated
    const { name, strength, form, category, brand } = req.body;

    try {
      const medicineWithName = await Medicine.findOne({
        where: { name, strength, form, brand, id: { [Op.ne]: id } },
      });

      if (medicineWithName) {
        return res
          .status(400)
          .json({ error: "Medicine with same specifications already exists" });
      }

      const medicine = await Medicine.findOne({
        where: { id, doctorId: req.user.hospitalId },
      });

      if (!medicine) {
        return res.status(404).json({ error: "Medicine not found" });
      }

      // Update medicine details
      medicine.name = name || medicine.name;
      medicine.strength = strength || medicine.strength;
      medicine.form = form || medicine.form;
      medicine.category = category || medicine.category;
      medicine.brand = brand || medicine.brand;

      await medicine.save();

      res
        .status(200)
        .json({ message: "Medicine updated successfully", medicine });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to update medicine", details: error.message });
    }
  },

  async deleteMedicine(req, res) {
    if (!req.user || req.user.role !== "receptionist") {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const { id } = req.params;

    try {
      const medicine = await Medicine.findOne({
        where: { id, doctorId: req.user.hospitalId },
      });

      if (!medicine) {
        return res.status(404).json({ error: "Medicine not found" });
      }

      await medicine.destroy();

      res.status(200).json({ message: "Medicine deleted successfully" });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to delete medicine", details: error.message });
    }
  },

  async addBulkMedicinesFromExcel(req, res) {
    try {
      const user = req.user;

      if (!user || user.role !== "receptionist") {
        return res.status(403).json({ error: "Unauthorized request" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Excel file is required" });
      }

      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const medicines = xlsx.utils.sheet_to_json(sheet);

      for (const med of medicines) {
        if (
          !med.name ||
          !med.strength ||
          !med.form ||
          !med.category ||
          !med.brand
        ) {
          return res.status(400).json({
            error:
              "Invalid excel file: Columns in excel file should be : name, strength, form, category, brand",
          });
        }

        const exists = await Medicine.findOne({
          where: {
            name: med.name,
            strength: med.strength,
            form: med.form,
            category: med.category,
            brand: med.brand,
          },
        });

        if (!exists) {
          await Medicine.create({
            name: med.name,
            strength: med.strength,
            form: med.form,
            category: med.category,
            brand: med.brand,
            doctorId: user.hospitalId,
          });
        }
      }

      return res.status(200).json({
        message: `${medicines.length} medicines added successfully`,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to add medicines" });
    }
  },
};

module.exports = medicineController;
