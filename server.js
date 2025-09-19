const express = require("express");
require("dotenv").config();
const bodyParser = require("body-parser");
const { setupWebSocket } = require("./websocket.js");
const http = require("http");

const app = express();

const cors = require("cors");
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);

app.set("trust proxy", true);

app.use((req, res, next) => {
  let ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip;

  if (ip === "::1") ip = "127.0.0.1";
  if (ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");

  req.clientIp = ip;
  next();
});

app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));

const doctorRouter = require("./routes/doctorRoutes.js");
const receptionistRoutes = require("./routes/receptionistRoutes.js");
const patientRoutes = require("./routes/patientRoutes.js");
const medicineRoutes = require("./routes/medicineRoutes.js");
const appointmentRoutes = require("./routes/appointmentRoutes.js");
const notificationRoutes = require("./routes/notificationRoutes.js");
const auditLogsRoutes = require("./routes/auditLogsRoutes.js");

app.use("/test", (req, res) => {
  res.send(`<h1>This is a test APInewew_19092025: ${req.clientIp}</h1>`);
});
app.use("/api/doctors", doctorRouter);
app.use("/api/receptionists", receptionistRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/audit-logs", auditLogsRoutes);

require("./jobs")();

const server = http.createServer(app);

setupWebSocket(server);

const errorHandler = require("./middlewares/errorHandler.js");
app.use(errorHandler);

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
