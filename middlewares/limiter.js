const rateLimit = require("express-rate-limit");

// Create a rate limiter middleware
exports.limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (15 minutes)
  message: "Too many requests from this IP, please try again after 15 minutes",
});
