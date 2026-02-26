const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const port = 3000;

app.use(express.static('public'));

const users = {};

io.on('connection', socket => {
    console.log(`Connection: ${socket.id}`);
    users[socket.id] = {
        id: socket.id
    };

    socket.on('update', (targetSocketId, data) => {
        if (!users[targetSocketId]) {
            return; // target niet gevonden, doe niets
        }
        // forward de update naar enkel die ene target
        socket.to(targetSocketId).emit('update', data);
    });

    socket.on('disconnect', () => {
        console.log('client disconnected');
        delete users[socket.id];
    });
});

server.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
