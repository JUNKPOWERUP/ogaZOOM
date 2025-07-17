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
  console.log("✅ 接続:", socket.id);

  socket.on("join-room", () => {
    if (room.includes(socket.id)) return;

    if (room.length >= 4) {
      socket.emit("room_full");
      return;
    }

    room.push(socket.id);
    socket.join("main");

    // 接続者に他ユーザーのIDを送信
    const otherUsers = room.filter(id => id !== socket.id);
    socket.emit("users", otherUsers);

    // ほかのユーザーに新規参加を通知
    socket.to("main").emit("user-joined", socket.id);
  });

  socket.on("signal", ({ to, data }) => {
    console.log(`🔁 signal from ${socket.id} to ${to}`);
    io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("disconnect", () => {
    console.log("❌ 切断:", socket.id);
    room = room.filter(id => id !== socket.id);
    io.to("main").emit("user-left", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🟢 Socket server on ${PORT}`));
