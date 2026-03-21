/**
 * connection.js – Receiver-side WebRTC (simple-peer) + Socket.IO signalling.
 * Listens for arrow-key commands over the data channel and drives the maze.
 */
import { makeMaze, movePlayer, resetMaze, startRaceMaze, moveRacePlayer } from "./maze.js";

const $status = document.getElementById('status');
const $qr = document.getElementById('qr');
const $raceInfo = document.getElementById('raceInfo');
const $modeSelection = document.getElementById('modeSelection');
const $modeSoloBtn = document.getElementById('modeSoloBtn');
const $modeDuoBtn = document.getElementById('modeDuoBtn');

let socket;
let mode = null;
let soloPeer = null;
const duoPeers = new Map();
let raceInProgress = false;

const MAX_DUO_PLAYERS = 2;

function setStatus(text) {
    if ($status) $status.textContent = text;
}

function setRaceInfo(text) {
    if ($raceInfo) $raceInfo.textContent = text;
}

function hideModeSelection() {
    if ($modeSelection) $modeSelection.style.display = 'none';
}

function showQr() {
    if ($qr) $qr.style.display = '';
}

function hideQr() {
    if ($qr) $qr.style.display = 'none';
}

function senderUrl() {
    return new URL(`/sender.html?id=${socket.id}&mode=${mode}`, window.location).href;
}

function renderQr() {
    const url = senderUrl();
    const typeNumber = 4;
    const errorCorrectionLevel = 'L';
    const qr = qrcode(typeNumber, errorCorrectionLevel);
    qr.addData(url);
    qr.make();
    $qr.innerHTML = qr.createImgTag(4);
}

function safeSend(peerObj, payload) {
    if (!peerObj || !peerObj.connected || !peerObj.peer) return;
    peerObj.peer.send(JSON.stringify(payload));
}

function broadcastDuo(payload) {
    duoPeers.forEach((peerObj) => safeSend(peerObj, payload));
}

function getConnectedCount() {
    let connectedCount = 0;
    duoPeers.forEach((peerObj) => {
        if (peerObj.connected) connectedCount++;
    });
    return connectedCount;
}

function getReadyCount() {
    let readyCount = 0;
    duoPeers.forEach((peerObj) => {
        if (peerObj.ready) readyCount++;
    });
    return readyCount;
}

function updateDuoLobbyStatus() {
    const connectedCount = getConnectedCount();

    if (connectedCount < MAX_DUO_PLAYERS) {
        setStatus(`Two-player mode: waiting for player ${connectedCount + 1} to connect…`);
        setRaceInfo(`${connectedCount}/${MAX_DUO_PLAYERS} connected`);
        showQr();
        return;
    }

    hideQr();
    const readyCount = getReadyCount();
    setStatus('Two-player mode: both connected. Press Start on both phones to begin level 3.');
    setRaceInfo(`${readyCount}/${MAX_DUO_PLAYERS} ready`);
}

function maybeStartRace() {
    if (mode !== 'duo' || raceInProgress) return;
    if (getConnectedCount() !== MAX_DUO_PLAYERS) return;

    const readyCount = getReadyCount();
    if (readyCount !== MAX_DUO_PLAYERS) return;

    raceInProgress = true;
    startRaceMaze();
    setStatus('Race started. First to reach the finish wins.');
    setRaceInfo('Race in progress');
    broadcastDuo({ type: 'raceStart' });
}

function finishRace(winnerIndex) {
    raceInProgress = false;
    duoPeers.forEach((peerObj) => {
        peerObj.ready = false;
    });
    setStatus(`Race finished. Player ${winnerIndex + 1} wins! Press Start on both phones to race again.`);
    setRaceInfo(`Winner: Player ${winnerIndex + 1}`);
    broadcastDuo({ type: 'raceFinished', winnerIndex });
}

function removeDuoPeer(peerId) {
    const peerObj = duoPeers.get(peerId);
    if (!peerObj) return;
    if (peerObj.connectTimeoutId) {
        clearTimeout(peerObj.connectTimeoutId);
        peerObj.connectTimeoutId = null;
    }
    if (peerObj.peer && !peerObj.peer.destroyed) peerObj.peer.destroy();
    duoPeers.delete(peerId);
    raceInProgress = false;
    resetMaze();
    setStatus('A player connection failed or disconnected. Ask them to rescan the QR code.');
    updateDuoLobbyStatus();
}

function handleDuoData(peerObj, msg) {
    if (msg.type === 'ready') {
        peerObj.ready = true;
        const readyCount = getReadyCount();
        broadcastDuo({ type: 'readyState', readyCount, total: MAX_DUO_PLAYERS });
        updateDuoLobbyStatus();
        maybeStartRace();
        return;
    }

    if (msg.type === 'move') {
        if (!raceInProgress) return;
        const result = moveRacePlayer(peerObj.playerIndex, msg.direction);
        if (result && result.winner !== null && result.winner !== undefined) {
            finishRace(result.winner);
        }
    }
}

function createDuoPeer(peerId, signalData) {
    if (duoPeers.has(peerId)) {
        duoPeers.get(peerId).peer.signal(signalData);
        return;
    }

    if (duoPeers.size >= MAX_DUO_PLAYERS) {
        setStatus('Two-player mode full. Extra connection ignored.');
        return;
    }

    const playerIndex = duoPeers.size;
    const peer = new SimplePeer({
        initiator: false,
        trickle: true,
        config: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        }
    });

    const peerObj = { peer, playerIndex, ready: false, connected: false, id: peerId, connectTimeoutId: null };
    duoPeers.set(peerId, peerObj);

    peerObj.connectTimeoutId = setTimeout(() => {
        if (!peerObj.connected && duoPeers.has(peerId)) {
            console.warn('Duo peer timed out before connect:', peerId);
            removeDuoPeer(peerId);
        }
    }, 30000);

    peer.on('signal', data => {
        socket.emit('signal', peerId, data);
    });

    peer.on('connect', () => {
        peerObj.connected = true;
        if (peerObj.connectTimeoutId) {
            clearTimeout(peerObj.connectTimeoutId);
            peerObj.connectTimeoutId = null;
        }
        safeSend(peerObj, { type: 'duoAssigned', playerIndex, total: MAX_DUO_PLAYERS });
        updateDuoLobbyStatus();
        if (getConnectedCount() === MAX_DUO_PLAYERS) {
            broadcastDuo({ type: 'readyState', readyCount: getReadyCount(), total: MAX_DUO_PLAYERS });
        }
    });

    peer.on('data', raw => {
        try {
            const msg = JSON.parse(raw.toString());
            handleDuoData(peerObj, msg);
        } catch (e) {
            console.warn('Bad duo data from peer:', e);
        }
    });

    peer.on('error', err => {
        console.error('Duo peer error:', err);
        removeDuoPeer(peerId);
    });

    peer.on('close', () => {
        removeDuoPeer(peerId);
    });

    peer.signal(signalData);
    updateDuoLobbyStatus();
}

function handleSoloData(raw) {
    try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'start') {
            resetMaze();
            makeMaze();
        }
        if (msg.type === 'move') {
            movePlayer(msg.direction);
        }
    } catch (e) {
        console.warn('Bad data from peer:', e);
    }
}

function createSoloPeer(peerId, signalData) {
    if (soloPeer && soloPeer.id !== peerId) {
        setStatus('Solo mode is already connected to another sender.');
        return;
    }

    if (!soloPeer) {
        const peer = new SimplePeer({
            initiator: false,
            trickle: true,
            config: {
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            }
        });

        soloPeer = { peer, id: peerId };

        peer.on('signal', data => {
            socket.emit('signal', peerId, data);
        });

        peer.on('connect', () => {
            setStatus('Connected! Sender can control the maze.');
            setRaceInfo('Solo mode');
            hideQr();
        });

        peer.on('data', handleSoloData);

        peer.on('error', err => {
            console.error('Peer error:', err);
            setStatus('Connection error – reload to retry.');
        });

        peer.on('close', () => {
            if (soloPeer && soloPeer.peer) soloPeer.peer.destroy();
            soloPeer = null;
            setStatus('Sender disconnected.');
            setRaceInfo('Solo mode');
            showQr();
            resetMaze();
        });
    }

    soloPeer.peer.signal(signalData);
}

function chooseMode(nextMode) {
    if (mode) return;
    mode = nextMode;
    hideModeSelection();
    renderQr();
    showQr();
    resetMaze();

    if (mode === 'solo') {
        setStatus('Solo mode: waiting for sender to scan QR code…');
        setRaceInfo('Complete 3 levels as fast as possible');
    } else {
        setStatus('Two-player mode: waiting for player 1 to connect…');
        setRaceInfo(`0/${MAX_DUO_PLAYERS} connected`);
    }
}

function initConnection() {
    socket = io.connect('/');

    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        setStatus('Choose a mode to begin.');
        setRaceInfo('');

        $modeSoloBtn?.addEventListener('click', () => chooseMode('solo'));
        $modeDuoBtn?.addEventListener('click', () => chooseMode('duo'));
    });

    // Signalling relay from server
    socket.on('signal', (fromId, signalData) => {
        console.log('Received signal from', fromId);

        if (!mode) {
            return;
        }

        if (mode === 'solo') {
            createSoloPeer(fromId, signalData);
            return;
        }

        createDuoPeer(fromId, signalData);
    });

    socket.on('peerDisconnect', peerId => {
        if (mode === 'solo') {
            if (soloPeer && soloPeer.id === peerId) {
                soloPeer.peer.destroy();
            }
            return;
        }

        if (mode === 'duo' && duoPeers.has(peerId)) {
            removeDuoPeer(peerId);
        }
    });
}

// Boot
initConnection();
