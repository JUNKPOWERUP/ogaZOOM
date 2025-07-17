// ✅ Render にデプロイした Socket.IO サーバーを指定
const socket = io("https://boine.onrender.com/");

const videoGrid = document.getElementById('video-grid');
const peers = {};
let localStream;
let userId = '';
let hasMedia = false;

// カメラ・マイクの確認と取得
async function initMedia() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasVideo = devices.some(device => device.kind === 'videoinput');
    const hasAudio = devices.some(device => device.kind === 'audioinput');

    if (!hasVideo && !hasAudio) throw new Error('No camera or mic');

    localStream = await navigator.mediaDevices.getUserMedia({
      video: hasVideo,
      audio: hasAudio,
    });

    hasMedia = true;
    addVideoStream(localStream, 'あなた');
    socket.emit('join-room');
  } catch (err) {
    console.error('❌ カメラ・マイク取得失敗:', err);
    socket.emit('join-room'); // メディアなしでも部屋には入る
  }
}

// 自分のビデオを表示
function addVideoStream(stream, label) {
  const video = document.createElement('video');
  video.playsInline = true;
  video.autoplay = true;
  video.srcObject = stream;

  const wrapper = document.createElement('div');
  wrapper.appendChild(video);
  wrapper.appendChild(document.createTextNode(label));
  videoGrid.appendChild(wrapper);

  video.onloadedmetadata = () => {
    video.play().catch(err => {
      console.warn('再生エラー:', err);
    });
  };
}

// カメラ・マイク切替
function toggleCamera() {
  if (localStream) {
    localStream.getVideoTracks().forEach(track => (track.enabled = !track.enabled));
  }
}
function toggleMic() {
  if (localStream) {
    localStream.getAudioTracks().forEach(track => (track.enabled = !track.enabled));
  }
}
function leaveRoom() {
  socket.disconnect();
  window.close();
}

// ソケットイベント
socket.on('connect', () => {
  userId = socket.id;
  initMedia();
});

socket.on('users', users => {
  users.forEach(remoteId => {
    connectToNewUser(remoteId);
  });
});

socket.on('user-joined', userId => {
  console.log('🆕 新規ユーザー:', userId);
  connectToNewUser(userId);
});

socket.on('signal', async ({ from, data }) => {
  const peer = peers[from];
  if (!peer) return;

  try {
    if (data.type === 'offer') {
      await peer.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('signal', { to: from, data: peer.localDescription });
    } else if (data.type === 'answer') {
      if (peer.signalingState === 'have-local-offer') {
        await peer.setRemoteDescription(new RTCSessionDescription(data));
      } else {
        console.warn('⚠️ setRemoteDescription wrong state:', peer.signalingState);
      }
    } else if (data.candidate) {
      await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  } catch (err) {
    console.error('❌ シグナリングエラー:', err);
  }
});

socket.on('user-left', id => {
  if (peers[id]) {
    peers[id].close();
    delete peers[id];
  }
});

function connectToNewUser(remoteId) {
  if (peers[remoteId]) return;

  const peer = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  peers[remoteId] = peer;

  if (localStream) {
    localStream.getTracks().forEach(track => {
      peer.addTrack(track, localStream);
    });
  }

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('signal', { to: remoteId, data: { candidate: e.candidate } });
    }
  };

  peer.ontrack = e => {
    const [stream] = e.streams;
    if (!document.getElementById(remoteId)) {
      addVideoStream(stream, '相手');
    }
  };

  // イニシエーター判定
  if (socket.id > remoteId) {
    peer.createOffer()
      .then(offer => peer.setLocalDescription(offer))
      .then(() => {
        socket.emit('signal', { to: remoteId, data: peer.localDescription });
      });
  }
}
