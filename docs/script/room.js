const socket = io("https://boine.onrender.com"); // ← HTTPS にしてください
const videoGrid = document.getElementById("video-grid");
const peerConnections = {};
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

let localStream;
let myId;

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    addVideoStream("自分", stream);
    socket.emit("join");

    socket.on("joined", (otherUsers) => {
      myId = socket.id;
      for (const id of otherUsers) {
        createPeerConnection(id, true);
      }
    });

    socket.on("new_user", id => {
      createPeerConnection(id, true);
    });

    socket.on("signal", async ({ from, data }) => {
      if (!peerConnections[from]) {
        createPeerConnection(from, false);
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
  })
  .catch(err => {
    console.warn("❌ カメラ・マイク取得失敗:", err);
  });

function createPeerConnection(id, isInitiator) {
  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;

  pc.ontrack = event => {
    if (!document.getElementById("video-" + id)) {
      addVideoStream(id, event.streams[0]);
    }
  };

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", { to: id, data: { candidate: e.candidate } });
    }
  };

  if (localStream) {
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });
  }

  if (isInitiator) {
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        socket.emit("signal", { to: id, data: pc.localDescription });
      });
  }
}

function addVideoStream(id, stream) {
  const video = document.createElement("video");
  video.id = "video-" + id;
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  if (id === "自分") video.muted = true;
  video.addEventListener("loadedmetadata", () => {
    video.play().catch(err => console.warn("再生エラー:", err));
  });
  videoGrid.appendChild(video);
}

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
