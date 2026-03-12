Als eerste heb ik de demo voor de qr-code ingevoegd
--> https://github.com/devinekask/creative-code-4-s26/tree/main/websockets

#### planing week 2:
- link direct naar IP-address
- video door geven van gsm naar computer
- start knop —> die timer weergeeft

Ik heb simple peer via de terminal geinstaleert
```bash
 npm install simple-peer
 ```

Mijn feedback en idee waren niet zo goed en mijn start was ook niet optimaal, dus ben ik opnieuw begonnen. Ik dacht dat het beter zou zijn om eerst de RTC-verbinding te maken en daarna pas de QR-code toe te voegen. Dit is wat ik gedaan heb:
Ik heb mijn stappen netjes laten opschrijven door AI, omdat ik tussendoor vergat te noteren en graag wilde doorwerken. Ook heb ik de uitleg uit de les gebruikt en aangegeven in welke volgorde ik alles heb gedaan, samen met de bijkomende fouten die ik gemaakt heb. AI had ook een paar extra dingen onthouden die ertussen zaten en heeft het dus gedetailleerder gemaakt. Ik heb de AI ook op ask gezet zodat ik zelf kan kijken en beslissen wanneer ik iets wil toepassen.

# restart

## Stap 1: Project opzetten

Ik ben begonnen met het initialiseren van een nieuw project:

```bash
npm init -y
npm install express
```

## Stap 2: Basis Express server

Ik heb een `index.js` bestand aangemaakt in de project root met een basis express server:

```javascript
const express = require('express')
const app = express()
const port = 3000

app.use(express.static('public'))
app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
```

En een start script toegevoegd aan `package.json`:

```json
"scripts": {
  "start": "node index.js"
}
```

## Stap 3: Webcam test pagina

Ik heb een `public` folder aangemaakt en daarin een `index.html` met een video tag:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Webcam</title>
</head>
<body>
  <video id="video" autoplay playsinline></video>
</body>
</html>
```

Daarna heb ik de webcam stream toegevoegd met JavaScript:

```javascript
const $video = document.getElementById('video');

const init = async () => {
  const constraints = {
    audio: false,
    video: true
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  $video.srcObject = stream;
};

init();
```

Dit werkte goed via localhost!

## Stap 4: HTTPS certificaat (voor toegang via IP)

Toen ik de app probeerde te openen via mijn IP-adres kreeg ik deze error:

```
(index):21 Uncaught (in promise) TypeError: Cannot read property 'getUserMedia' of undefined
```

Webcam access werkt alleen via HTTPS. Dus heb ik een self-signed SSL certificaat aangemaakt:

```bash
openssl req -x509 -out localhost.crt -keyout localhost.key \
  -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=localhost' -extensions EXT -config <( \
   printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")
```

Ik heb de server code aangepast om HTTPS te gebruiken:

```javascript
const fs = require('fs');
const options = {
  key: fs.readFileSync('./localhost.key'),
  cert: fs.readFileSync('./localhost.crt')
};
const server = require('https').Server(options, app);
```

**Maar hier maakte ik een fout!** Ik had nog steeds `app.listen()` staan ipv `server.listen()`. Dat moest ik veranderen naar:

```javascript
server.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
```

Nu werkte de webcam ook via het IP-adres!

## Stap 5: Development vs Production

Om het verschil te maken tussen local en production heb ik een `.env` file aangemaakt:

```
NODE_ENV=development
```

En dotenv package geïnstalleerd:

```bash
npm install dotenv
```

Bovenaan `index.js` toegevoegd:

```javascript
require('dotenv').config();
```

Een boolean check gemaakt:

```javascript
const isDevelopment = (process.env.NODE_ENV === 'development');
```

En de server startup aangepast:

```javascript
let options = {};
if (isDevelopment) {
  options = {
    key: fs.readFileSync('./localhost.key'),
    cert: fs.readFileSync('./localhost.crt')
  };
}

const server = require(isDevelopment ? 'https' : 'http').Server(options, app);
```

`.gitignore` aangemaakt:

```
*.crt
*.key
.env
```

## Stap 6: File system package

Ik probeerde `fs` te installeren maar dit hoefde niet:

```bash
npm install fs
```

Dit package zit al standaard in Node.js, dus dit was eigenlijk overbodig.

## Stap 7: Sender pagina

Ik heb de sender pagina gekopieerd van de oefening in de les en het IP-adres aangepast naar het mijne.

## Stap 8: Socket.io voor WebRTC

**Hier vergat ik eerst socket.io te installeren!** Later kwam ik erachter en moest ik dit nog doen:

```bash
npm install socket.io
```

Daarna heb ik de socket.io logica toegevoegd aan `index.js`:

```javascript
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
```

## Stap 9: Receiver pagina - Basis setup

Ik ben begonnen met een nieuwe HTML file `receiver.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebRTC</title>
  <style>
    video {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <h1>Receiver</h1>
  <video id="otherCamera" playsinline autoplay muted></video>
  <script src="/socket.io/socket.io.js"></script>
  <script type="module">

    const $otherCamera = document.getElementById('otherCamera');

    let socket;
    let peerConnection;

    const servers = {
      iceServers: [{
        urls: `stun:stun.l.google.com:19302`
      }]
    };

    const init = async () => {
      initSocket();
    };

    const initSocket = () => {
      socket = io.connect(`/`);
      socket.on(`connect`, () => {
        console.log(socket.id);
      });
    };

    init();

  </script>
</body>
</html>
```

Daarna een listener toegevoegd voor de peerOffer:

```javascript
socket.on('peerOffer', (myId, offer, peerId) => {
  console.log(`Received peerOffer from ${peerId}`);
});
```

## Stap 10: Receiver - Answer peer offer

Ik heb een `answerPeerOffer` methode aangemaakt:

```javascript
const answerPeerOffer = async (myId, offer, peerId) => {
  peerConnection = new RTCPeerConnection(servers);
};
```

Remote description instellen:

```javascript
await peerConnection.setRemoteDescription(offer);
```

Answer aanmaken en versturen:

```javascript
const answer = await peerConnection.createAnswer();
await peerConnection.setLocalDescription(answer);
socket.emit(`peerAnswer`, peerId, answer);
```

De methode aangeroepen vanuit de socket event handler:

```javascript
socket.on('peerOffer', (myId, offer, peerId) => {
  console.log(`Received peerOffer from ${peerId}`);
  answerPeerOffer(myId, offer, peerId);
});
```

## Stap 11: ICE candidates afhandelen

ICE candidate handler toegevoegd aan peerConnection:

```javascript
peerConnection.onicecandidate = (e) => {
  console.log('ice candidate', e.candidate);
  socket.emit('peerIce', peerId, e.candidate);
};
```

Socket listener voor incoming ICE candidates:

```javascript
socket.on('peerIce', async (myId, candidate, peerId) => {
  console.log(`Received peerIce from ${peerId}`, candidate);
  await handlePeerIce(myId, candidate, peerId);
});
```

HandlePeerIce functie aangemaakt:

```javascript
const handlePeerIce = async (myId, candidate, peerId) => {
  if (!candidate) {
    return;
  }
  await peerConnection.addIceCandidate(candidate);
};
```

**Hier kreeg ik een error:**

```
Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'addIceCandidate')
```

Mijn prompt: 
```Kan je helpen met deze error?: ncaught (in promise) TypeError: Cannot read properties of undefined (reading 'addIceCandidate')
at handlePeerIce (receiver.html:77:34)
at Socket.<anonymous> (receiver.html:50:23)
at Emitter.emit (index.js:136:20)
at Socket.emitEvent (socket.js:552:20)
at Socket.onevent (socket.js:539:18)
at Socket.onpacket (socket.js:507:22)
at Emitter.emit (index.js:136:20)
at manager.js:217:18```

Het probleem was dat `peerConnection` nog `undefined` was. Ik moest de volgorde aanpassen in `answerPeerOffer`:

```javascript
const answerPeerOffer = async (myId, offer, peerId) => {
    // 1. EERST peerConnection aanmaken
    peerConnection = new RTCPeerConnection(servers);

    // 2. DAARNA event handlers registreren
    peerConnection.onicecandidate = (e) => {
        console.log('ice candidate', e.candidate);
        if (e.candidate) {
            socket.emit('peerIce', peerId, e.candidate);
        }
    };

    peerConnection.ontrack = (e) => {
        console.log('ontrack');
        $otherCamera.srcObject = e.streams[0];
    };

    // 3. En dan pas remote description instellen
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit(`peerAnswer`, peerId, answer);
};
```

En extra check toegevoegd in handlePeerIce:

```javascript
const handlePeerIce = async (myId, candidate, peerId) => {
    if (!candidate || !peerConnection) {
        return;
    }
    await peerConnection.addIceCandidate(candidate);
};
```

## Stap 12: Video stream toevoegen (sender)

In de sender moest ik de video tracks toevoegen aan de peer connection:

```javascript
for (const track of myStream.getTracks()) {
  peerConnection.addTrack(track, myStream);
}
```

## Stap 13: Video stream ontvangen (receiver)

Ontrack event handler toegevoegd aan peerConnection om de stream te tonen:

```javascript
peerConnection.ontrack = (e) => {
  console.log('ontrack');
  $otherCamera.srcObject = e.streams[0];
};
```

## Stap 14: Answer afhandelen in sender

De sender moet nog het answer van de receiver afhandelen:

```javascript
socket.on('peerAnswer', async (myId, answer, peerId) => {
  console.log('Received peerAnswer from ${peerId}');
  console.log(answer);
  await handlePeerAnswer(myId, answer, peerId);
});
```

HandlePeerAnswer functie:

```javascript
const handlePeerAnswer = async (myId, answer, peerId) => {
  await peerConnection.setRemoteDescription(answer);
};
```

## QR code toevoegen (receiver)

Ik heb ook een QR code toegevoegd aan de receiver zoals moet voor de opdracht:

```html
<div id="qr"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
```

```javascript
const typeNumber = 4;
const errorCorrectionLevel = 'L';
const qr = qrcode(typeNumber, errorCorrectionLevel);
qr.addData('https://192.168.10.56:3000/sender.html');
qr.make();
document.getElementById('qr').innerHTML = qr.createImgTag(4);
```

## Testen

De app werkt nu! Je kan:

1. `receiver.html` openen op je smartphone
2. QR code scannen om `sender.html` te openen
3. De receiver selecteren in de dropdown
4. De video stream verschijnt op de receiver

**Belangrijke opmerking voor Safari:** Soms moet je op de video klikken voordat deze start. Dit kan opgelost worden met:

```javascript
$otherCamera.addEventListener('click', () => {
  $otherCamera.play();
});
```

Als laatste heb ik nog index.html verwijderd omdat het niet meer nodig was.

## 📅 Planning

| Taak                         | Uitleg                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Doolhofspel werkend krijgen  | De lijn die gevolgd wordt verwijderen en zorgen dat je altijd alle kanten op kan (overtollige code verwijderen). |
| Peer list verwijderen        | Directe verbinding laten maken tussen sender en receiver.                                                        |
| Knoppen doorgeven via sender | De knoppen (inputs) doorgeven via de sender, net zoals de video wordt doorgegeven.                               |
| Extra spel: gsm schudden     | Een spel toevoegen waarbij je de gsm moet schudden om te snijden.                                                |
| Randomizer                   | Bij het starten van de app wordt willekeurig een spel gekozen.                                                   |
| Uitleg voor elk spel         | Een korte tekst die verschijnt voordat het spel begint, die je kan overslaan met de pijltjestoets.               |



# eerste spel

Als eerste spel wil ik een doolhof maken. Online heb ik opgezocht hoe je dit het beste aanpakt en kwam ik deze tutorial tegen:
[Navigating the Labyrinth: A Maze Generator Game using HTML, CSS & JavaScript (GeeksforGeeks)](https://www.geeksforgeeks.org/javascript/navigating-the-labyrinth-a-maze-generator-game-using-html-css-javascript/)

Ik heb de code in mijn receiver-pagina geïntegreerd en ben nu bezig om de onnodige delen te verwijderen. Op dit moment ben ik vooral bezig met CSS te vewijderen.


# week 3

Ik heb de demo voor de simple peer in de index.js volledig gezet en dan aan ai gevraagd om dat door te trekken naar de index.html en sender.html.

```javascript
zou je dit kunnen laten werken via simple peer, dus mijn index en sender?
```

Now I have a clear picture. I'll convert the project from raw RTCPeerConnection to simple-peer. This simplifies signaling — instead of separate offer/answer/ice events, simple-peer uses a single "signal" event.

Let me update all three files:

Now update sender.html to use simple-peer:

Edited
sender.html+32-64
Also remove the now-unnecessary peer select dropdown from sender.html:

Now update the WebRTC part in index.html (receiver) to use simple-peer:

Let me verify the final state of all files:

Ik heb de een andere maze genomen die beter past en werkt bij mijn concept.
https://codepen.io/anthropoco/pen/ZRmYvZ

Html:
```javascript
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta charset="utf-8">
</head>

<body>
  <div id="gradient"></div>
  <div id="page">
    <div id="Message-Container">
      <div id="message">
        <h1>Congratulations!</h1>
        <p>You are done.</p>
        <p id="moves"></p>
        <input id="okBtn" type="button" onclick="toggleVisablity('Message-Container')" value="Cool!" />
      </div>

    </div>
    <div id="menu">

      <div class="custom-select">
        <select id="diffSelect">
                    <option value="10">Easy</option>
                    <option value="15">Medium</option>
                    <option value="25">Hard</option>
                    <option value="38">Extreme</option>
        </select>
      </div>
      <input id="startMazeBtn" type="button" onclick="makeMaze()" value="Start" />

    </div>

    <div id="mazeContainer">
      <canvas id="mazeCanvas" height="1100" width="1100"></canvas>
    </div>
  </div>
</body>
```

Js:
```javascript
function Coordinate(X, Y) {
    this.x = X;
    this.y = Y;
}

function rand(max) {
    return (Math.floor(Math.random() * max));
}

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function Maze(Width, Height) {
    var mazeMap;
    var width = Width;
    var height = Height;
    var startCoord, endCoord;
    var dirs = ["n", "s", "e", "w"];
    var modDir = {
        n: {
            y: -1,
            x: 0,
            o: "s"
        },
        s: {
            y: 1,
            x: 0,
            o: "n"
        },
        e: {
            y: 0,
            x: 1,
            o: "w"
        },
        w: {
            y: 0,
            x: -1,
            o: "e"
        }
    };

    this.map = function () {
        return mazeMap;
    };
    this.startCoord = function () {
        return startCoord;
    };
    this.endCoord = function () {
        return endCoord;
    };

    function genMap() {
        mazeMap = new Array(height);
        for (y = 0; y < height; y++) {
            mazeMap[y] = new Array(width);
            for (x = 0; x < width; ++x) {
                mazeMap[y][x] = {
                    n: false,
                    s: false,
                    e: false,
                    w: false,
                    visited: false,
                    priorPos: null
                };
            }
        }
    }

    function defineMaze() {
        var isComp = false;
        var move = false;
        var cellsVisited = 1;
        var numLoops = 0;
        var maxLoops = 0;
        var pos = new Coordinate(0, 0); //this.endCoord;
        var numCells = width * height;
        while (!isComp) {
            move = false;
            mazeMap[pos.x][pos.y].visited = true;

            if (numLoops >= maxLoops) {
                shuffle(dirs);
                maxLoops = Math.round(rand(height / 8));
                numLoops = 0;
            }
            numLoops++;
            for (index = 0; index < dirs.length; index++) {
                var direction = dirs[index];
                var nx = pos.x + modDir[direction].x;
                var ny = pos.y + modDir[direction].y;

                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    //Check if the tile is already visited
                    if (!mazeMap[nx][ny].visited) {
                        //Carve through walls from this tile to next
                        mazeMap[pos.x][pos.y][direction] = true;
                        mazeMap[nx][ny][modDir[direction].o] = true;

                        //Set Currentcell as next cells Prior visited
                        mazeMap[nx][ny].priorPos = pos;
                        //Update Cell position to newly visited location
                        pos = new Coordinate(nx, ny);

                        cellsVisited++;
                        //Recursively call this method on the next tile
                        move = true;
                        break;
                    }
                }
            }

            if (!move) {
                //If it failed to find a direction and didnt get back to the EndPoint, move the current position back to the prior cell and Recall the method.
                pos = mazeMap[pos.x][pos.y].priorPos;
            }
            if (numCells == cellsVisited) {
                isComp = true;
            }
        }
    }

    function defineStartEnd() {
        switch (rand(4)) {
            case 0:
                startCoord = new Coordinate(0, 0);
                endCoord = new Coordinate(height - 1, width - 1);
                break;
            case 1:
                startCoord = new Coordinate(0, width - 1);
                endCoord = new Coordinate(height - 1, 0);
                break;
            case 2:
                startCoord = new Coordinate(height - 1, 0);
                endCoord = new Coordinate(0, width - 1);
                break;
            case 3:
                startCoord = new Coordinate(height - 1, width - 1);
                endCoord = new Coordinate(0, 0);
                break;
        }
    }

    genMap();
    defineStartEnd();
    defineMaze();
}
function DrawMaze(Maze, ctx, cellsize) {
    var map = Maze.map();
    var cellSize = cellsize;
    
    this.redrawMaze = function (cellsize) {
        cellSize = cellsize;
        drawMap();
        drawEnd(Maze.endCoord());
    };


    function drawCell(xCord, yCord, cell) {
        var x = xCord * cellSize;
        var y = yCord * cellSize;
        ctx.lineWidth = cellSize/ 50;

        if (cell.n === false) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            
            ctx.lineTo(x + cellSize, y);
            ctx.stroke();
        }
        if (cell.s === false) {
            ctx.beginPath();
            ctx.moveTo(x, y + cellSize);
            ctx.lineTo(x + cellSize, y + cellSize);
            ctx.stroke();
        }
        if (cell.e === false) {
            ctx.beginPath();
            ctx.moveTo(x + cellSize, y);
            ctx.lineTo(x + cellSize, y + cellSize);
            ctx.stroke();
        }
        if (cell.w === false) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + cellSize);
            ctx.stroke();
        }
    }

    function drawMap() {
        for (x = 0; x < map.length; x++) {
            for (y = 0; y < map[x].length; y++) {
                drawCell(x, y, map[x][y]);
            }
        }
    }

    function drawEnd(coord) {
        var gridSize = 5;
        var offset = 7;

        var fraction = cellSize / gridSize - 2;
        var colorSwap = true;
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                ctx.beginPath();
                ctx.rect(
                    coord.x * cellSize + x * fraction + 4.5,
                    coord.y * cellSize + y * fraction + 4.5,
                    fraction,
                    fraction
                );
                if (colorSwap) {
                    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
                } else {
                    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                }
                ctx.fill();
                colorSwap = !colorSwap;
            }
        }
    }

    function clear() {
        var canvasSize = cellSize * map.length;
        ctx.clearRect(0, 0, canvasSize, canvasSize);
    }

    clear();
    drawMap();
    drawEnd(Maze.endCoord());
}
function Player(maze, c, _cellsize, onComplete, sprite = null) {
    var ctx = c.getContext("2d");
    var drawSprite;
    var moves = 0;
    drawSprite = drawSpriteCircle;
    if (sprite != null) {
        drawSprite = drawSpriteImg;
    }
    var player = this;
    var map = maze.map();
    var preCoord = new Coordinate(maze.startCoord().x, maze.startCoord().y);
    var cellSize = _cellsize;
    var halfCellSize = cellSize / 2;


    this.redrawPlayer = function (_cellsize) {
        cellSize = _cellsize;        
        drawSpriteImg(preCoord);
    }

    function drawSpriteCircle(coord) {
        ctx.beginPath();
        ctx.fillStyle = "yellow";
        ctx.arc(
            (coord.x + 1) * cellSize - halfCellSize,
            (coord.y + 1) * cellSize - halfCellSize,
            halfCellSize - 2,
            0,
            2 * Math.PI
        );
        ctx.fill();
        if (coord.x === maze.endCoord().x && coord.y === maze.endCoord().y) {
            onComplete(moves);
            player.unbindKeyDown();
        }
    }

    function drawSpriteImg(coord) {
        ctx.drawImage(
            sprite,
            72,
            29,
            320,
            435,
            coord.x * cellSize + 4,
            coord.y * cellSize + 4,
            cellSize - 8,
            cellSize - 8
        );
        if (coord.x === maze.endCoord().x && coord.y === maze.endCoord().y) {
            onComplete(moves);
            player.unbindKeyDown();
        }
    }

    function removeSprite(coord) {
        ctx.clearRect(
            coord.x * cellSize + 1,
            coord.y * cellSize + 1,
            cellSize - 2,
            cellSize - 2
        );
    }

    function check(e) {
        var cell = map[preCoord.x][preCoord.y];
        var code = e.keyCode;
        moves++;
        switch (code) {
            case 65:
            case 37: // west
                if (cell.w == true) {
                    removeSprite(preCoord);
                    preCoord = new Coordinate(preCoord.x - 1, preCoord.y);
                    drawSprite(preCoord);
                }

                break;
            case 87:
            case 38: // north
                if (cell.n == true) {
                    removeSprite(preCoord);
                    preCoord = new Coordinate(preCoord.x, preCoord.y - 1);
                    drawSprite(preCoord);
                }
                break;
            case 68:
            case 39: // east
                if (cell.e == true) {
                    removeSprite(preCoord);
                    preCoord = new Coordinate(preCoord.x + 1, preCoord.y);
                    drawSprite(preCoord);
                }
                break;
            case 83:
            case 40: // south
                if (cell.s == true) {
                    removeSprite(preCoord);
                    preCoord = new Coordinate(preCoord.x, preCoord.y + 1);
                    drawSprite(preCoord);
                }
                break;
        }
    }

 this.bindKeyDown = function () {
        window.addEventListener("keydown", check, false);

        $("#mazeCanvas").swipe({
            swipe: function (event, direction, distance, duration, fingerCount, fingerData) {
                console.log(direction)
                switch (direction) {
                    case "up":
                        check({
                            keyCode: 38
                        });
                        break;
                    case "down":
                        check({
                            keyCode: 40
                        })
                        break;
                    case "left":
                        check({
                            keyCode: 37
                        });
                        break;
                    case "right":
                        check({
                            keyCode: 39
                        });
                        break;
                }
                
            },
            threshold: 0
        });
    };

    this.unbindKeyDown = function () {
        window.removeEventListener("keydown", check, false);
        $("#mazeCanvas").swipe("destroy");
    };

    drawSprite(maze.startCoord());

    this.bindKeyDown();
}
var mazeCanvas = document.getElementById("mazeCanvas");
var ctx = mazeCanvas.getContext("2d");
var sprite;
var maze, draw, player;
var cellSize;
var difficulty;
// sprite.src = 'media/sprite.png';

window.onload = function () {
    if (window.innerHeight < window.innerWidth) {
        ctx.canvas.width = window.innerHeight - (75 + (window.innerHeight / 100));
        ctx.canvas.height = window.innerHeight - (75 + (window.innerHeight / 100));
    }
    else{
        ctx.canvas.width = window.innerWidth - (75 + (window.innerWidth / 100));
        ctx.canvas.height = window.innerWidth - (75 + (window.innerWidth / 100));
    }
    cellSize = mazeCanvas.width / difficulty;
    defineSprite();
};

window.onresize = function (event) {
    if (window.innerHeight < window.innerWidth) {
        ctx.canvas.width = window.innerHeight - (75 + (window.innerHeight / 100));
        ctx.canvas.height = window.innerHeight - (75 + (window.innerHeight / 100));
    }
    else{
        ctx.canvas.width = window.innerWidth - (75 + (window.innerWidth / 100));
        ctx.canvas.height = window.innerWidth - (75 + (window.innerWidth / 100));
    }

    cellSize = mazeCanvas.width / difficulty;
    if (player != null) {
        draw.redrawMaze(cellSize);
        player.redrawPlayer(cellSize);
    }

};

function defineSprite() {
    var spr = new Image();
    var url = "https://78.media.tumblr.com/99dbdc2634a3695d60120eebe865a785/tumblr_onsimhGBbN1rgyab2o1_1280.png";
    spr.src = url + "?" + new Date().getTime();
    spr.setAttribute("crossOrigin", " ");
    spr.onload = function changeBritness() {

        var virtCanvas = document.createElement('canvas');
        virtCanvas.width = 500;
        virtCanvas.height = 500;
        var context = virtCanvas.getContext('2d');

        context.drawImage(spr, 0, 0, 500, 500);
        var imgData = context.getImageData(0, 0, 500, 500);

        var factor = 1.20;
        for (let i = 0; i < imgData.data.length; i += 4) {
            imgData.data[i] = imgData.data[i] * factor;
            imgData.data[i + 1] = imgData.data[i + 1] * factor;
            imgData.data[i + 2] = imgData.data[i + 2] * factor;
        }
        context.putImageData(imgData, 0, 0);

        sprite = new Image();
        sprite.src = virtCanvas.toDataURL();
    };
}



function makeMaze() {
    document.getElementById("mazeCanvas").classList.add("border");
    if (player != undefined) {
        player.unbindKeyDown();
    }
    difficulty = getDifficulty();
    cellSize = mazeCanvas.width / difficulty;
    maze = new Maze(difficulty, difficulty);
    draw = new DrawMaze(maze, ctx, cellSize);
    player = new Player(maze, mazeCanvas, cellSize, displayVictoryMess);//, sprite);
    if (document.getElementById("mazeContainer").style.opacity < "100") {
        document.getElementById("mazeContainer").style.opacity = "100";
    }
}

function displayVictoryMess(moves) {
    document.getElementById("moves").innerHTML = "You Moved " + moves + " Steps.";
    toggleVisablity("Message-Container");
    document.getElementById("okBtn").focus();
}

function getDifficulty() {
    var e = document.getElementById("diffSelect");
    return e.options[e.selectedIndex].value;
}

function toggleVisablity(id) {
    if (document.getElementById(id).style.visibility == "visible") {
        document.getElementById(id).style.visibility = "hidden";
    } else {
        document.getElementById(id).style.visibility = "visible";
    }
}
```

Ai:
promt:
```javascript
wil je dit mooi zetten en werkend maken? De js van de maze mag eigenlijk ook in een appart js file staan en de css ook.
```

antwoord:
Now I have a full picture. The CSS has SCSS syntax that doesn't work in plain CSS, the maze JS uses jQuery for swipe but jQuery isn't included, and everything is jumbled in one file. Let me create clean, separated files.

Now replace the entire index.html with a clean version:

cat > "/Users/elinedeblancq/Documents/devine/2de 2025-26/2de semester/cc 4/WebRTC/WebRTCOpdracht/public/index.html" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Maze Receiver</title>
    <link rel="stylesheet" href="/css/style.css">
</head>

<body>
    <div id="gradient"></div>

    <div id="page">
        <!-- Victory overlay -->
        <div id="Message-Container">
            <div id="message">
                <h1>Congratulations!</h1>
                <p>You are done.</p>
                <p id="moves"></p>
                <input id="okBtn" type="button" onclick="toggleVisablity('Message-Container')" value="Cool!" />
            </div>
        </div>

        <!-- Menu -->
        <div id="menu">
            <div class="custom-select">
                <select id="diffSelect">
                    <option value="10">Easy</option>
                    <option value="15">Medium</option>
                    <option value="25">Hard</option>
                    <option value="38">Extreme</option>
                </select>
            </div>
            <input id="startMazeBtn" type="button" onclick="makeMaze()" value="Start" />
        </div>

        <!-- QR code -->
        <div id="qr"></div>

        <!-- Maze -->
        <div id="mazeContainer">
            <canvas id="mazeCanvas" height="1100" width="1100"></canvas>
        </div>

        <!-- WebRTC video -->
        <video id="otherCamera" playsinline autoplay muted></video>
    </div>

    <!-- Dependencies -->
    <script src="/socket.io/socket.io.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/simple-peer@9/simplepeer.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>

    <!-- App scripts -->
    <script src="/js/maze.js"></script>
    <script src="/js/connection.js"></script>
</body>

</html>
HTMLEOF
Alles is opgesplitst en opgeruimd. Hier is de nieuwe structuur:

Wat is opgelost:

CSS: SCSS-syntax ($variabelen, @extend, %placeholders, nesting) omgezet naar geldige CSS
Maze JS: Alle maze-gerelateerde code (Coordinate, Maze, DrawMaze, Player, UI functies) in maze.js
Connection JS: WebRTC simple-peer logica + QR code in connection.js
Touch support: jQuery swipe dependency vervangen door vanilla touchstart/touchend events — geen jQuery meer nodig
index.html: Van ~775 regels naar ~65 regels, enkel markup
Claude Opus 4.6 • 3x

--> dit werkt niet goed
Ik ben opnieuw begonen van voor de maze te veranderen.

Dan heb ik de nieuwe maze weer toegevoeg.
Deze werkte niet direct en heb ik errors gekregen, heb aan ai gevraagd dit werkende te maken.

promt:
```javascript
Kan je nu mijn maze  werkende maken want ik heb nu deze errors: (index):1 Access to image at 'https://78.media.tumblr.com/99dbdc2634a3695d60120eebe865a785/tumblr_onsimhGBbN1rgyab2o1_1280.png?1773311149149' from origin 'https://172.30.82.156:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.Understand this error
tumblr_onsimhGBbN1rgyab2o1_1280.png?1773311149149:1  Failed to load resource: net::ERR_FAILEDUnderstand this error
5(index):205 Uncaught ReferenceError: makeMaze is not defined
    at HTMLInputElement.onclick 
```

--> dit werkte weer niet, heb dan aan ai gevraagd om van nul de maze te maken.

promt:
```javascript
Can you create a maze where the maze is displayed in index.html and the controls/arrows are routed through the sender? The maze is randomly generated when the sender is connected to the other sender via RTC. The video can be omitted entirely. Everything must be done via the peer connection (RTC).
```

responce:
Now I have a clear picture. I'll build the whole thing:

index.html (receiver): displays the maze, shows QR code for sender to connect
sender.html: has arrow controls (buttons + keyboard), sends directions over the WebRTC data channel
No video at all — pure data channel via simple-peer
Maze is generated when the peer connects
Let me create all the files:

Now rewrite the two HTML files. The new index.html from the terminal context is the target structure:

Edited
index.html+44-10
Now I need to remove the old inline script that's left over:

I see — the old script block ended up after the </html> tag. Let me remove it:

Now rewrite sender.html — arrow buttons + keyboard, data channel only, no video:

Let me verify the final state of all files:

Everything is set up. Here's how it works:

Architecture
Page	Role
index.html	Receiver — displays the maze + QR code. Waits for the sender to connect.
sender.html	Controller — shows arrow buttons (+ keyboard support). Sends moves over WebRTC data channel.
Flow
Open https://localhost:3000 → shows a QR code + "Waiting for sender…"
Scan the QR (or open the link on another device/tab) → sender connects via simple-peer data channel only (no video/audio)
As soon as the peer connection establishes, a random maze is generated on the receiver
The sender presses arrows (buttons or keyboard) → { type: "move", direction: "ArrowUp" } is sent over peer.send() → receiver calls movePlayer() to update the maze
Reaching the bottom-right corner shows a victory overlay with move count
Files created/changed
style.css — styling for both pages
maze.js — maze generation, rendering, player movement
connection.js — receiver-side simple-peer + Socket.IO signalling
sender.html — controller with arrow buttons + data channel
index.html — clean receiver page
index.js — server unchanged (already had the simple signal relay)
Run npm start and open https://localhost:3000 to try it.




promt:
```javascript
Can you make it so that when you complete the maze, it restarts and makes it a bit more difficult? After three levels, you'll get the time it took. You'll then have the option to restart. After completing it a second time, you'll get your best time and the time for that round.
```

output