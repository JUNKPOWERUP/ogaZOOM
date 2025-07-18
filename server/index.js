const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let room = [];

io.on("connection", (socket) => {
  socket.on("join-room", () => {
    if (room.includes(socket.id)) return;

    if (room.length >= 4) {
      socket.emit("room_full");
      return;
    }

    room.push(socket.id);
    socket.join("main");

    const others = room.filter(id => id !== socket.id);
    socket.emit("users", others);
    socket.to("main").emit("user-joined", socket.id);
  });

  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("disconnect", () => {
    room = room.filter(id => id !== socket.id);
    io.to("main").emit("user-left", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🟢 Server started on port ${PORT}`);
});
