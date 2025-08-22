const express = require("express");
const app = express();
const http = require("http"); // Import HTTP for Socket.IO
const server = http.createServer(app); // Create an HTTP server
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL, // Your frontend URL
    methods: ["GET", "POST"], // Methods allowed
    credentials: true, // Allows cookies to be sent along with the requests
  },
});

module.exports = {
  app,
  io,
  server,
};
