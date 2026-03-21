const $status = document.getElementById('sender-status');
const $startBtn = document.getElementById('startBtn');
let socket;
let peer;
let connected = false;
let activeIndex = 0;
let countdownId = null;
let countdownRunning = false;
let audioCtx = null;
let mode = 'solo';
let playerIndex = null;
let localReady = false;
let raceRunning = false;

/* ── Send a direction over the data channel ── */
function sendMove(direction) {
    if (!peer || !connected) return;
    peer.send(JSON.stringify({ type: 'move', direction }));
}

function sendControl(type) {
    if (!peer || !connected) return;
    peer.send(JSON.stringify({ type }));
}

document.getElementById('startBtn').addEventListener('click', () => {
    if (!connected) return;

    if (mode === 'solo') {
        sendControl('start');
        activeIndex = 0;
        stopCountdown();
        startcountdown();
        $status.textContent = 'Solo game started. Tilt your phone to move.';
        return;
    }

    if (mode === 'duo' && !localReady) {
        localReady = true;
        raceRunning = false;
        stopCountdown();
        sendControl('ready');
        $startBtn.disabled = true;
        $startBtn.textContent = 'Ready!';
        $status.textContent = 'You are ready. Waiting for the other player...';
    }
});

document.querySelectorAll('.arrow-grid button').forEach(btn => {
    btn.addEventListener('touchstart', e => { e.preventDefault(); btn.click(); }, { passive: false });
});

/* ── Read target id from query string ── */
function getUrlParameter(name) {
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? false : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

function updateStartButtonForMode() {
    if (mode === 'duo') {
        $startBtn.textContent = 'Ready';
        return;
    }
    $startBtn.textContent = 'Start / Restart';
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

function getMappedDirection(key) {
    const list = directionMap[key];
    return list ? list[activeIndex] : null;
}

function startcountdown() {
    if (countdownRunning) return;
    countdownRunning = true;
    scheduleNextPick();
}

function pickRandomDelay(min = 10, max = 20) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function scheduleNextPick() {
    const delayMs = pickRandomDelay() * 1000;
    countdownId = setTimeout(() => {
        pickRandomIndex();
        notifyCountdown();
        if (countdownRunning) scheduleNextPick();
    }, delayMs);
}

function stopCountdown() {
    countdownRunning = false;
    if (countdownId !== null) {
        clearTimeout(countdownId);
        countdownId = null;
    }
}

function pickRandomIndex() {
    activeIndex = Math.floor(Math.random() * 4);
}

function notifyCountdown() {
    let didVibrate = false;
    if (navigator.vibrate) {
        didVibrate = navigator.vibrate([80, 40, 80]);
    }
    if (!didVibrate) {
        playBeep();
    }
}

function playBeep() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        if (!audioCtx) audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.0001;
        gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.22);
    } catch (e) {
        return;
    }
}

(function init() {
    const targetSocketId = getUrlParameter('id');
    const modeParam = getUrlParameter('mode');
    if (modeParam === 'duo' || modeParam === 'solo') {
        mode = modeParam;
    }
    updateStartButtonForMode();

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
            if (mode === 'duo') {
                $status.textContent = 'Connected! Waiting for player assignment...';
            } else {
                $status.textContent = 'Connected! Tilt your phone to move. When your phone vibrates, the directions can change.';
            }
        });

        peer.on('data', raw => {
            try {
                const msg = JSON.parse(raw.toString());

                if (msg.type === 'duoAssigned') {
                    playerIndex = msg.playerIndex;
                    const label = playerIndex !== null ? playerIndex + 1 : '?';
                    $status.textContent = `Connected as Player ${label}. Press Ready to enter the race.`;
                    return;
                }

                if (msg.type === 'readyState' && mode === 'duo') {
                    $status.textContent = `Lobby ready: ${msg.readyCount}/${msg.total}.`;
                    return;
                }

                if (msg.type === 'raceStart' && mode === 'duo') {
                    localReady = false;
                    raceRunning = true;
                    activeIndex = 0;
                    $startBtn.disabled = false;
                    $startBtn.textContent = 'Ready';
                    $status.textContent = 'Race started! Tilt your phone now.';
                    stopCountdown();
                    startcountdown();
                    return;
                }

                if (msg.type === 'raceFinished' && mode === 'duo') {
                    raceRunning = false;
                    localReady = false;
                    stopCountdown();
                    $startBtn.disabled = false;
                    $startBtn.textContent = 'Ready';
                    const iWon = playerIndex !== null && msg.winnerIndex === playerIndex;
                    $status.textContent = iWon
                        ? 'You won! Press Ready to race again.'
                        : `Player ${msg.winnerIndex + 1} won. Press Ready to race again.`;
                    return;
                }
            } catch (e) {
                console.warn('Bad receiver data:', e);
            }
        });

        peer.on('error', err => {
            console.error('Peer error:', err);
            $status.textContent = 'Connection error – reload to retry.';
        });

        peer.on('close', () => {
            connected = false;
            raceRunning = false;
            localReady = false;
            stopCountdown();
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