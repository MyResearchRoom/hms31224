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

app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));

const doctorRouter = require("./routes/doctorRoutes.js");
const receptionistRoutes = require("./routes/receptionistRoutes.js");
const patientRoutes = require("./routes/patientRoutes.js");
const medicineRoutes = require("./routes/medicineRoutes.js");
const appointmentRoutes = require("./routes/appointmentRoutes.js");
const notificationRoutes = require("./routes/notificationRoutes.js");

app.use("/test", (req, res) => res.send("<h1>This is a test API29082025-v2</h1>"));
app.use("/api/doctors", doctorRouter);
app.use("/api/receptionists", receptionistRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/notifications", notificationRoutes);
const server = http.createServer(app);

setupWebSocket(server);

const errorHandler = require("./middlewares/errorHandler.js");
app.use(errorHandler);

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
