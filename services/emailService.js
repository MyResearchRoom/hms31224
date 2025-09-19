const nodemailer = require("nodemailer");

// Set up nodemailer transporter for sending verification emails
exports.transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL, // Your email
    pass: process.env.EMAIL_PASSWORD, // Your email password
  },
});
