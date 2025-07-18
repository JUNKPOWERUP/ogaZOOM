const socket = io("https://boine.onrender.com/"); // ← RenderのURLに必ず置き換えてください

const videoGrid = document.getElementById('video-grid');
const peers = {};
let localStream = null;
let hasMedia = false;

async function initMedia() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasVideo = devices.some(d => d.kind === 'videoinput');
    const hasAudio = devices.some(d => d.kind === 'audioinput');

    if (!hasVideo && !hasAudio) throw new Error('カメラ・マイクなし');

    localStream = await navigator.mediaDevices.getUserMedia({
      video: hasVideo,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      }
    });

    // 🔴 カメラをデフォルトでOFFにする
    localStream.getVideoTracks().forEach(track => track.enabled = false);

    hasMedia = true;
    addMyVideoStream(localStream, socket.id);

  } catch (err) {
    console.warn('🎥⚠️ メディア取得失敗:', err);
  } finally {
    socket.emit("join-room");
  }
}


// 自分の映像を表示（名前非表示・ミュート）
function addMyVideoStream(stream, id) {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.controls = false; // 自分のコントロールは不要
  video.id = id;

  const wrapper = document.createElement('div');
  wrapper.appendChild(video);
  videoGrid.appendChild(wrapper);

  video.onloadedmetadata = () => video.play().catch(console.warn);
}

// 他ユーザーの映像追加（名前なし・音声出力）
function addVideoStream(stream, id) {
  if (document.getElementById(id)) return;

  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.muted = false;   // ← 音声出力する
  video.controls = true; // ← ユーザーが音量調整できる
  video.id = id;

  const wrapper = document.createElement('div');
  wrapper.appendChild(video);
  videoGrid.appendChild(wrapper);

  video.onloadedmetadata = () => video.play().catch(console.warn);
}

function toggleCamera() {
  if (localStream) {
    localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
  }
}
function toggleMic() {
  if (localStream) {
    localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
  }
}
function leaveRoom() {
  // ソケット切断
  socket.disconnect();

  // PeerConnectionをすべて閉じる
  Object.values(peers).forEach(p => p.close());

  // 映像エリアをクリア
  videoGrid.innerHTML = '';

  // カメラ・マイク停止
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }

  // 少し待ってからページ遷移（安全に処理を終えるため）
  setTimeout(() => {
    window.location.href = "https://junkpowerup.github.io/ogaZOOM/";
  }, 1000);
}


socket.on('connect', () => {
  initMedia();
});

socket.on('room_full', () => {
  alert("このルームは満員です（最大4人）");
  window.close();
});

socket.on('users', users => {
  users.forEach(connectToUser);
});

socket.on('user-joined', connectToUser);

function connectToUser(remoteId) {
  if (peers[remoteId]) return;

  const peer = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  peers[remoteId] = peer;

  if (hasMedia && localStream) {
    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
  }

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", { to: remoteId, data: { candidate: e.candidate } });
    }
  };

  peer.ontrack = e => {
    const [stream] = e.streams;
    addVideoStream(stream, remoteId);
  };

  if (socket.id > remoteId) {
    peer.createOffer()
      .then(offer => peer.setLocalDescription(offer))
      .then(() => {
        socket.emit("signal", { to: remoteId, data: peer.localDescription });
      });
  }
}

socket.on("signal", async ({ from, data }) => {
  const peer = peers[from];
  if (!peer) return;

  try {
    if (data.type === 'offer') {
      await peer.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("signal", { to: from, data: peer.localDescription });
    } else if (data.type === 'answer') {
      await peer.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.candidate) {
      await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  } catch (err) {
    console.error('❌ シグナリングエラー:', err);
  }
});

socket.on("user-left", id => {
  if (peers[id]) {
    peers[id].close();
    delete peers[id];
    const el = document.getElementById(id);
    if (el) el.parentElement.remove();
  }
});
