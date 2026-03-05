require('dotenv').config();
const express = require('express')
const app = express()
const port = 3000

const isDevelopment = (process.env.NODE_ENV === 'development');

const fs = require('fs');

let options = {};
if (isDevelopment) {
    options = {
        key: fs.readFileSync('./localhost.key'),
        cert: fs.readFileSync('./localhost.crt')
    };
}

const server = require(isDevelopment ? 'https' : 'http').Server(options, app);

app.use(express.static('public'))
server.listen(port, () => {
    console.log(`App listening on port ${port}`)
})

const { Server } = require("socket.io");
const io = new Server(server);

const clients = {};
io.on('connection', socket => {
    clients[socket.id] = { id: socket.id };

    socket.on('disconnect', () => {
        delete clients[socket.id];
        io.emit('clients', clients);
    });

    socket.on('peerOffer', (peerId, offer) => {
        console.log(`Received peerOffer from ${socket.id} to ${peerId}`);
        io.to(peerId).emit('peerOffer', peerId, offer, socket.id);
    });

    socket.on('peerAnswer', (peerId, answer) => {
        console.log(`Received peerAnswer from ${socket.id} to ${peerId}`);
        io.to(peerId).emit('peerAnswer', peerId, answer, socket.id);
    });

    socket.on('peerIce', (peerId, candidate) => {
        console.log(`Received peerIce from ${socket.id} to ${peerId}`);
        io.to(peerId).emit('peerIce', peerId, candidate, socket.id);
    });

    io.emit('clients', clients);

});