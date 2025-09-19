const multer = require("multer");

const errorHandler = (err, req, res, next) => {
  let statusCode = err.status || 500;
  let message = "Internal Server Error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = err.message || "Validation Error";
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
  } else if (err.code === 11000) {
    statusCode = 409;
    message = "Duplicate key error";
  } else if (err.name === "UnauthorizedError") {
    statusCode = 401;
    message = "Unauthorized access";
  } else if (err.name === "ForbiddenError") {
    statusCode = 403;
    message = "You do not have permission to access this resource";
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      statusCode = 400;
      message = "File is too large. Max size is 2MB.";
    } else if (err.code === "LIMIT_FILE_COUNT") {
      statusCode = 400;
      message = "Too many files uploaded. Max allowed is 1.";
    } else {
      statusCode = 400;
      message = `Multer Error: ${err.message}`;
    }
  }

  if (err.message && err.message.includes("Invalid file type")) {
    statusCode = 400;
    message = err.message;
  }

  res.status(statusCode).json({
    status: "error",
    statusCode: statusCode,
    error: message,
  });
};

module.exports = errorHandler;
