/**
 * connection.js – Receiver-side WebRTC (simple-peer) + Socket.IO signalling.
 * Listens for arrow-key commands over the data channel and drives the maze.
 */
import { makeMaze, movePlayer, resetMaze } from "./maze.js";

const $status = document.getElementById('status');
const $qr = document.getElementById('qr');

let socket;
let peer;

function showQr() {
    if ($qr) $qr.style.display = '';
}

function hideQr() {
    if ($qr) $qr.style.display = 'none';
}

function initConnection() {
    socket = io.connect('/');

    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        if ($status) $status.textContent = 'Waiting for sender to scan QR code…';

        // Show QR code with link to sender
        const url = new URL(`/sender.html?id=${socket.id}`, window.location).href;
        console.log('Sender URL:', url);

        const typeNumber = 4;
        const errorCorrectionLevel = 'L';
        const qr = qrcode(typeNumber, errorCorrectionLevel);
        qr.addData(url);
        qr.make();
        document.getElementById('qr').innerHTML = qr.createImgTag(4);
        showQr();
    });

    // Signalling relay from server
    socket.on('signal', (fromId, signalData) => {
        console.log('Received signal from', fromId);

        if (!peer) {
            // Create non-initiator peer (data-only, no streams)
            peer = new SimplePeer({
                initiator: false,
                trickle: true,
                config: {
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                }
            });

            peer.on('signal', data => {
                socket.emit('signal', fromId, data);
            });

            peer.on('connect', () => {
                console.log('Peer connected!');
                if ($status) $status.textContent = 'Connected! Sender can control the maze.';
                hideQr();
                // Generate the maze as soon as the peer connects
                makeMaze();
            });

            peer.on('data', raw => {
                // Sender sends JSON messages like { type: "move", direction: "ArrowUp" }
                try {
                    const msg = JSON.parse(raw.toString());
                    if (msg.type === 'move') {
                        movePlayer(msg.direction);
                    }
                } catch (e) {
                    console.warn('Bad data from peer:', e);
                }
            });

            peer.on('error', err => {
                console.error('Peer error:', err);
                if ($status) $status.textContent = 'Connection error – reload to retry.';
            });

            peer.on('close', () => {
                console.log('Peer closed');
                if ($status) $status.textContent = 'Sender disconnected.';
                showQr();
                resetMaze();
                peer = null;
            });
        }

        peer.signal(signalData);
    });
}

// Boot
initConnection();
