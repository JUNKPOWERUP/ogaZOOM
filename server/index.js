const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let room = [];

io.on("connection", socket => {
  console.log("connect:", socket.id);

  socket.on("join", () => {
    if (room.length >= 4) {
      socket.emit("room_full");
      return;
    }
    room.push(socket.id);
    socket.join("main");
    socket.emit("joined", room.filter(id => id !== socket.id));
    socket.to("main").emit("new_user", socket.id);
  });

  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("disconnect", () => {
    room = room.filter(id => id !== socket.id);
    io.to("main").emit("user_left", socket.id);
    console.log("disconnect:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`● Socket server on ${PORT}`));
