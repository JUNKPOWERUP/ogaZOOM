const socket = io("https://boine.onrender.com/"); // ←適宜書き換えてください
const videoGrid = document.getElementById("video-grid");
const peerConnections = {};
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

let localStream;
let myId;

// カメラ・マイクの取得
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    addVideoStream("自分", stream);

    socket.emit("join");

    socket.on("joined", (otherUsers) => {
      myId = socket.id;
      for (const id of otherUsers) {
        createPeerConnection(id, true); // 自分から発信
      }
    });

    socket.on("new_user", id => {
      createPeerConnection(id, true); // 新規ユーザーに発信
    });

    socket.on("signal", async ({ from, data }) => {
      if (!peerConnections[from]) {
        createPeerConnection(from, false); // 受信側として初期化
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
    console.error("❌ カメラ・マイク取得失敗:", err);
    alert("カメラとマイクの使用を許可してください。");
  });

function createPeerConnection(id, isInitiator) {
  const pc = new RTCPeerConnection(config);
  peerConnections[id] = pc;

  // 映像・音声を相手に送る
  if (localStream) {
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });
  }

  // 相手の映像・音声を受信
  pc.ontrack = event => {
    if (!document.getElementById("video-" + id)) {
      addVideoStream(id, event.streams[0]);
    }
  };

  // ICE candidate を送信
  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", { to: id, data: { candidate: e.candidate } });
    }
  };

  // 発信側は offer を作成
  if (isInitiator) {
    pc.createOffer().then(offer => {
      return pc.setLocalDescription(offer);
    }).then(() => {
      socket.emit("signal", { to: id, data: pc.localDescription });
    });
  }
}

// 映像を画面に表示
function addVideoStream(id, stream) {
  const video = document.createElement("video");
  video.id = "video-" + id;
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  if (id === "自分") video.muted = true;
  videoGrid.appendChild(video);
}

// カメラ/マイク制御・退出機能
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
