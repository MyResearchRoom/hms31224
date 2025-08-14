require("dotenv").config();
const bodyParser = require("body-parser");
const { io, server, app } = require("./socket/socket.js");
const { limiter } = require("./middlewares/limiter.js");

// app.use(limiter);

const morgan = require("morgan");
// app.use(morgan("dev"));

const cors = require("cors");
app.use(
  cors({
    origin: process.env.CLIENT_URL, // Allow only your front-end domain
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));

const doctorRouter = require("./routes/doctorRoutes.js");
const receptionistRoutes = require("./routes/receptionistRoutes.js");
const patientRoutes = require("./routes/patientRoutes.js");
const medicineRoutes = require("./routes/medicineRoutes.js");
const appointmentRoutes = require("./routes/appointmentRoutes.js");

app.use("/test", (req, res) => res.send("<h1>This is a test API</h1>"));
app.use("/api/doctors", doctorRouter);
app.use("/api/receptionists", receptionistRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/appointments", appointmentRoutes);

const errorHandler = require("./middlewares/errorHandler.js");
app.use(errorHandler);

// Socket.IO event handling
io.on("connection", (socket) => {
  console.log("A user connected");

  // Example event: receiving a message
  socket.on("message", (data) => {
    console.log("Message received:", data);
    // Broadcast the message to all clients
    io.emit("message", data);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const PORT = process.env.PORT || 8000;

// Start the server with Socket.IO
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
