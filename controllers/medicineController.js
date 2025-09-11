const { Op } = require("sequelize");
const { Medicine, AuditLog, sequelize } = require("../models");
const xlsx = require("xlsx");

const medicineController = {
  async addMedicine(req, res) {
    if (!req.user || req.user.role !== "receptionist") {
      return res.status(401).json({ error: "Unauthorized request" });
    }

    const { medicinename, strength, form, category, brand } = req.body;

    const transaction = await sequelize.transaction();

    try {
      const medicineWithName = await Medicine.findOne({
        where: { medicinename, strength, form, brand },
        transaction,
      });

      if (medicineWithName) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Medicine with same specifications already exists" });
      }

      const medicine = await Medicine.create(
        {
          medicinename,
          strength,
          form,
          category,
          brand,
          doctorId: req.user.hospitalId,
        },
        { transaction }
      );

      const newMedicineData = {
        id: medicine.id,
        medicinename: medicine.medicinename,
        strength: medicine.strength,
        form: medicine.form,
        category: medicine.category,
        brand: medicine.brand,
        doctorId: medicine.doctorId,
      };

      await AuditLog.create(
        {
          action: "Add Medicine",
          details: `Added medicine ${medicinename} (${strength}, ${form}, ${brand})`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: null,
          oldValue: null,
          newValue: newMedicineData,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

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
        whereClause.medicinename = {
          [Op.like]: `%${searchTerm}%`,
        };
      }

      const medicines = await Medicine.findAll({
        where: whereClause,
        order: [["medicinename", "ASC"]],
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
    const { medicinename, strength, form, category, brand } = req.body;

    const transaction = await sequelize.transaction();

    try {
      const medicineWithName = await Medicine.findOne({
        where: { medicinename, strength, form, brand, id: { [Op.ne]: id } },
        transaction,
      });

      if (medicineWithName) {
        return res
          .status(400)
          .json({ error: "Medicine with same specifications already exists" });
      }

      const medicine = await Medicine.findOne({
        where: { id, doctorId: req.user.hospitalId },
        transaction,
      });

      if (!medicine) {
        await transaction.rollback();
        return res.status(404).json({ error: "Medicine not found" });
      }

      const oldMedicineData = medicine.toJSON();

      // Update medicine details
      medicine.medicinename = medicinename || medicine.medicinename;
      medicine.strength = strength || medicine.strength;
      medicine.form = form || medicine.form;
      medicine.category = category || medicine.category;
      medicine.brand = brand || medicine.brand;

      await medicine.save({ transaction });

      const newMedicineData = medicine.toJSON();

      await AuditLog.create(
        {
          action: "Edit Medicine",
          details: `Edited medicine ${oldMedicineData.medicinename} (${oldMedicineData.strength}, ${oldMedicineData.form}, ${oldMedicineData.brand}) → ${newMedicineData.medicinename} (${newMedicineData.strength}, ${newMedicineData.form}, ${newMedicineData.brand})`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: null,
          oldValue: oldMedicineData,
          newValue: newMedicineData,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

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

      const deletedData = {
        medicinename: medicine.medicinename,
        strength: medicine.strength,
        form: medicine.form,
        category: medicine.category,
        brand: medicine.brand,
      };

      await medicine.destroy();

      await AuditLog.create({
        receptionistId: req.user.id,
        doctorId: null,
        hospitalId: req.user.hospitalId,
        action: "Delete Medicine",
        details: `Deleted medicine ${medicine.medicinename} (${medicine.strength}, ${medicine.form}, ${medicine.brand})`,
        oldValue: deletedData,
        newValue: null,
        ipAddress: req.clientIp,
        userAgent: req.headers["user-agent"],
      });

      res.status(200).json({ message: "Medicine deleted successfully" });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to delete medicine", details: error.message });
    }
  },

  async addBulkMedicinesFromExcel(req, res) {
    const transaction = await sequelize.transaction();
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
      const medicinesRaw = xlsx.utils.sheet_to_json(sheet);

      const medicines = medicinesRaw.map((med) => {
        const normalized = {};
        for (const key in med) {
          const cleanKey = key.toLowerCase().replace(/\s+/g, "");
          normalized[cleanKey] = med[key];
        }
        return normalized;
      });

      const addedMedicines = [];

      for (const med of medicines) {
        if (
          !med.medicinename ||
          !med.strength ||
          !med.form ||
          !med.category ||
          !med.brand
        ) {
          await transaction.rollback();
          return res.status(400).json({
            error:
              "Invalid Excel format. Columns in excel file must be in mentioned format: medicinename, strength, form, category, brand",
          });
        }

        const exists = await Medicine.findOne({
          where: {
            medicinename: med.medicinename,
            strength: med.strength,
            form: med.form,
            category: med.category,
            brand: med.brand,
          },
          transaction,
        });

        if (!exists) {
          const created = await Medicine.create(
            {
              medicinename: med.medicinename,
              strength: med.strength,
              form: med.form,
              category: med.category,
              brand: med.brand,
              doctorId: user.hospitalId,
            },
            { transaction }
          );

          addedMedicines.push({
            medicineId: created.id,
            medicinename: created.medicinename,
            strength: created.strength,
            form: created.form,
            category: created.category,
            brand: created.brand,
          });
        }
      }

      if (addedMedicines.length > 0) {
        await AuditLog.create(
          {
            action: "Bulk Upload Medicines",
            details: `Receptionist ${user.name} added ${addedMedicines.length} medicines from Excel`,
            hospitalId: user.hospitalId,
            doctorId: req.user.role === "doctor" ? req.user.id : null,
            receptionistId:
              req.user.role === "receptionist" ? req.user.id : null,
            oldValue: null,
            newValue: addedMedicines,
            ipAddress: req.clientIp,
            userAgent: req.headers["user-agent"],
          },
          { transaction }
        );
      }

      await transaction.commit();

      return res.status(200).json({
        message: `${medicines.length} medicines added successfully`,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to add medicines" });
    }
  },
};

module.exports = medicineController;
