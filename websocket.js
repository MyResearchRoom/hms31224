const WebSocket = require("ws");
const url = require("url");
const jwt = require("jsonwebtoken");

const doctors = new Map();
let receptionists = new Map();


exports.updateCheckInOutNotification = (payload, doctorId) => {
  const doctorWs = doctors.get(doctorId);
  if (doctorWs && doctorWs.readyState === WebSocket.OPEN) {
    doctorWs.send(JSON.stringify(payload));
  }
};

exports.update = (payload, hospitalId) => {
  const receptionistsArr = receptionists.get(hospitalId) || [];
  for (const receptionist of receptionistsArr) {
    if (receptionist.ws.readyState === WebSocket.OPEN) {
      receptionist.ws.send(JSON.stringify(payload));
    }
  }
  const doctorWs = doctors.get(hospitalId);
  if (doctorWs && doctorWs.readyState === WebSocket.OPEN) {
    doctorWs.send(JSON.stringify(payload));
  }
};

exports.setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on("connection", async (ws, req) => {
    const { query } = url.parse(req.url, true);
    const { token } = query;

    if (!token) {
      ws.close(4001, "Token missing");
      return;
    }

    let user;
    try {
      user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      ws.close(4002, "Invalid token");
      return;
    }

    if (user.role === "receptionist") {
      if (!receptionists.has(user.hospitalId)) {
        receptionists.set(user.hospitalId, []);
      }
      const receptionistsArr = receptionists.get(user.hospitalId) || [];
      const existingReceptionistIndex =
        receptionistsArr && receptionistsArr.length > 0
          ? receptionistsArr.findIndex(
              (receptionist) => receptionist.id === user.id
            )
          : -1;
      if (existingReceptionistIndex !== -1)
        receptionistsArr[existingReceptionistIndex].ws = ws;
      else receptionistsArr.push({ id: user.id, ws });
      receptionists.set(user.hospitalId, receptionistsArr);
    } else {
      doctors.set(user.id, ws);
    }

    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.send(
      JSON.stringify({ type: "info", message: "Connected to WebSocket server" })
    );

    ws.on("close", () => {
      if (user.role === "receptionist" && receptionists.length > 0)
        receptionists = receptionists.filter(({ id }) => id !== user.id);
      if (user.role === "doctor" && doctors.has(user.id))
        doctors.delete(user.id);
    });
  });

  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  console.log("✅ WebSocket server initialized");
};
