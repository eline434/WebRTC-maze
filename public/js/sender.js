const $status = document.getElementById('sender-status');
let socket;
let peer;
let connected = false;

/* ── Send a direction over the data channel ── */
function sendMove(direction) {
    if (!peer || !connected) return;
    peer.send(JSON.stringify({ type: 'move', direction }));
}

function sendControl(type) {
    if (!peer || !connected) return;
    peer.send(JSON.stringify({ type }));
}

document.getElementById('startBtn').addEventListener('click', () => sendControl('start'));

document.querySelectorAll('.arrow-grid button').forEach(btn => {
    btn.addEventListener('touchstart', e => { e.preventDefault(); btn.click(); }, { passive: false });
});

/* ── Read target id from query string ── */
function getUrlParameter(name) {
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? false : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

function motion(event) {
    var left_right = event.accelerationIncludingGravity.x;
    var top_bottom = event.accelerationIncludingGravity.y;
    var front_back = event.accelerationIncludingGravity.z;

    var pitch_deg = Math.atan2(top_bottom, front_back) * (180 / Math.PI);
    var roll_deg = Math.atan2(left_right, front_back) * (180 / Math.PI);
    var threshold = 55;

    if (pitch_deg < -threshold) {
        sendMove(getMappedDirection('pitchUp'));
    }
    if (pitch_deg > threshold) {
        sendMove(getMappedDirection('pitchDown'));
    }
    if (roll_deg < -threshold) {
        sendMove(getMappedDirection('rollLeft'));
    }
    if (roll_deg > threshold) {
        sendMove(getMappedDirection('rollRight'));
    }
}

const directionMap = {
    pitchUp: ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'],
    pitchDown: ['ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight'],
    rollLeft: ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'],
    rollRight: ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']
};

let activeIndex = 0;

function getMappedDirection(key) {
    const list = directionMap[key];
    return list ? list[activeIndex] : null;
}

function pickRandomIndex() {
    activeIndex = Math.floor(Math.random() * 4);
}

setInterval(pickRandomIndex, 20000);

(function init() {
    const targetSocketId = getUrlParameter('id');
    if (!targetSocketId) {
        $status.textContent = 'Missing target ID in URL.';
        return;
    }

    socket = io.connect('/');

    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        $status.textContent = 'Signalling…';

        // Create initiator peer – data only, no streams
        peer = new SimplePeer({
            initiator: true,
            trickle: true,
            config: {
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            }
        });

        peer.on('signal', signalData => {
            socket.emit('signal', targetSocketId, signalData);
        });

        peer.on('connect', () => {
            console.log('Peer connected!');
            connected = true;
            $status.textContent = 'Connected! Use the arrows to move.';
        });

        peer.on('error', err => {
            console.error('Peer error:', err);
            $status.textContent = 'Connection error – reload to retry.';
        });

        peer.on('close', () => {
            connected = false;
            $status.textContent = 'Disconnected.';
        });
    });

    // Relay signals from receiver
    socket.on('signal', (fromId, signalData) => {
        console.log('Received signal from', fromId);
        if (peer) peer.signal(signalData);
    });

    if (window.DeviceMotionEvent) {
        window.addEventListener("devicemotion", motion, false);
    }
    else {
        alert('Tilt is not supported on your current device. Try this page on your mobile device?');
    }
})();