// utils/logger.js
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const LOG_FILE_PATH = path.join(__dirname, "../encryption_logs.xlsx");

function writePerformanceLog(logData) {
  let workbook;
  let worksheet;
  const sheetName = "Logs";

  if (fs.existsSync(LOG_FILE_PATH)) {
    // Read existing workbook and worksheet
    workbook = XLSX.readFile(LOG_FILE_PATH);

    if (workbook.Sheets[sheetName]) {
      // Sheet exists, convert to JSON and append
      const existingData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      existingData.push(logData);
      worksheet = XLSX.utils.json_to_sheet(existingData);
    } else {
      // Sheet does not exist yet
      worksheet = XLSX.utils.json_to_sheet([logData]);
    }
  } else {
    // No workbook, create new one with the log
    workbook = XLSX.utils.book_new();
    worksheet = XLSX.utils.json_to_sheet([logData]);
  }

  // Overwrite or add the sheet safely
  workbook.Sheets[sheetName] = worksheet;

  // Ensure only one instance of the sheet in SheetNames
  if (!workbook.SheetNames.includes(sheetName)) {
    workbook.SheetNames.push(sheetName);
  }

  // Save updated workbook
  XLSX.writeFile(workbook, LOG_FILE_PATH);
}

module.exports = { writePerformanceLog };
