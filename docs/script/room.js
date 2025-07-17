const socket = io("https://boine.onrender.com/"); // ←ここは後で置き換え
const videoGrid = document.getElementById("video-grid");
const peerConnections = {};
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
let localStream;
let myId;

// カメラ・マイクを取得
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
  localStream = stream;
  addVideoStream("自分", stream);

  socket.emit("join");

  socket.on("joined", (otherUsers) => {
    myId = socket.id;
    for (const id of otherUsers) {
      callUser(id);
    }
  });

  socket.on("new_user", id => {
    callUser(id);
  });

  socket.on("signal", async ({ from, data }) => {
    if (!peerConnections[from]) {
      const pc = new RTCPeerConnection(config);
      peerConnections[from] = pc;
      setupPeer(pc, from);
    }
    const pc = peerConnections[from];
    if (data.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("signal", { to: from, data: pc.localDescription });
    } else if (data.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  });

  socket.on("user_left", id => {
    const video = document.getElementById("video-" + id);
    if (video) video.remove();
    if (peerConnections[id]) {
      peerConnections[id].close();
      delete peerConnections[id];
    }
  });

  socket.on("room_full", () => {
    alert("部屋は満員です");
    window.location.href = "index.html";
  });
});

function callUser(id) {
  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;
  setupPeer(pc, id);

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  pc.createOffer().then(offer => {
    pc.setLocalDescription(offer);
    socket.emit("signal", { to: id, data: offer });
  });
}

function setupPeer(pc, id) {
  pc.ontrack = e => {
    if (!document.getElementById("video-" + id)) {
      addVideoStream(id, e.streams[0]);
    }
  };
  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", { to: id, data: { candidate: e.candidate } });
    }
  };
}

function addVideoStream(id, stream) {
  const video = document.createElement("video");
  video.id = "video-" + id;
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;

  // ✅ 自分の映像はミュート（音を出さない）
  if (id === "自分") {
    video.muted = true;
  }

  videoGrid.appendChild(video);
}


// ボタン制御
function toggleCamera() {
  localStream.getVideoTracks().forEach(track => {
    track.enabled = !track.enabled;
  });
}
function toggleMic() {
  localStream.getAudioTracks().forEach(track => {
    track.enabled = !track.enabled;
  });
}
function leaveRoom() {
  socket.disconnect();
  location.href = "index.html";
}
