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

    // 音声にエコーキャンセル・ノイズ抑制を入れて取得
    localStream = await navigator.mediaDevices.getUserMedia({
      video: hasVideo,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      }
    });

    hasMedia = true;

    // 自分の映像を表示するvideoタグ（自分の声はミュート）
    addMyVideoStream(localStream, socket.id);

  } catch (err) {
    console.warn('🎥⚠️ メディア取得失敗:', err);
  } finally {
    socket.emit("join-room");
  }
}

// 自分用ビデオ要素を作る（ミュート必須！）
function addMyVideoStream(stream, id) {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;       // ← これで自分の声が聞こえない
  video.autoplay = true;
  video.playsInline = true;
  video.id = id;

  const wrapper = document.createElement('div');
  wrapper.appendChild(video);
  wrapper.appendChild(document.createTextNode('あなた'));
  videoGrid.appendChild(wrapper);

  video.onloadedmetadata = () => video.play().catch(console.warn);
}

// 他ユーザーの映像追加
function addVideoStream(stream, label, id) {
  if(document.getElementById(id)) return; // 重複防止

  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.id = id;

  const wrapper = document.createElement('div');
  wrapper.appendChild(video);
  wrapper.appendChild(document.createTextNode(label));
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
  socket.disconnect();
  window.close();
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
    addVideoStream(stream, '相手', remoteId);
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
