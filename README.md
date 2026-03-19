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

Wat gegenereerd was, was gelukkig bijna dezelfde code als de eerste maze die ik hed en zo ook makkelijk te verstaan was.

Hierbij heb ik dan dit gevoegd:

promt:
```javascript
Can you make it so that when you complete the maze, it restarts and makes it a bit more difficult? After three levels, you'll get the time it took. You'll then have the option to restart. After completing it a second time, you'll get your best time and the time for that round.
```

output:
Now I'll implement all the changes. Let me update the maze.js, index.html, and style.css files together.

Let me verify the final state of the files:

Everything looks good. Here's a summary of what was implemented:

3-level round system:

Completing a maze auto-advances to the next level (after a 1.2s "Level done" flash)
Each level increases the grid size by 3 cells (e.g. Easy: 10 → 13 → 16)
A "Level X / 3" indicator shows progress in the menu bar
Timer & best time:

A timer starts when the round begins and runs across all 3 levels
After level 3, a "Round Complete!" overlay shows the total time
On subsequent rounds it also shows your best time, with a "New best!" highlight if you beat it
Restart flow:

The "Play Again" button on the round-complete overlay starts a fresh 3-level round from the base difficulty

review:
Zelf ga ik nog een paar dingen weghalen en verbeteren zodat het beter werkt.


## consult
- pijltjes op de gsm groter maken
- exporten via 1 js file (controler is de hoofd js file en die krijgt alles binnen --> stuurt dat dan door via export en maze import dan wat nodig is om het dan weer te exporten)
--> qr-code doen verdwijnen
--> opnieuw starten wanneer disconect

zelf:
- bewegen ook via gyroscoop laten gaan
- om zoveel seconden de richting doen veranderen en dat moeilijker per level maken

## gyroscoop

Online heb ik gezocht voor een voorbeeld hiervan en kwam uit op deze code:
https://github.com/shortland/Tilt/blob/master/js/tilt.js

Hiervan heb ik dit toegevoeg aan de sender
```javascript
	if(window.DeviceMotionEvent)
	{
		window.addEventListener("devicemotion", motion, false);
	}
	else
	{
		alert('Tilt is not supported on your current device. Try this page on your mobile device?');
	}

```

Dit is om de gyroscoop aan te roepen en kijken of dit ook werkt

Dan heb ik de code toegevoegd die kijkt hoe de gyroscoop staat.

```javascript
function motion(event)
{
	var left_right = event.accelerationIncludingGravity.x;
	var top_bottom = event.accelerationIncludingGravity.y;
	
	var pre_move_y = Math.floor(top_bottom);
	var pre_move_x = Math.floor(left_right);
	
	var key_x = localStorage.getItem('presetx');
	var key_y = localStorage.getItem('presety');
	if(!key_x && !key_y)
	{
		var y_preset = parseInt(pre_move_y);
		var x_preset = parseInt(pre_move_x);
		localStorage.setItem('presety', y_preset);
		localStorage.setItem('presetx', x_preset);
		return false;
		// next motion event will get executed (I guess we could potentially execute this one aswell...
	}
	else
	{
		if(pre_move_y < 0)
		{
			var move_y = parseInt(pre_move_y) + Math.abs(parseInt(key_y));	
		}
		else
		{
			var move_y = (pre_move_y) - (key_y);	
		}
		if(pre_move_x < 0)
		{
			var move_x = parseInt(pre_move_x) + Math.abs(parseInt(key_x));	
		}
		else
		{
			var move_x = (pre_move_x) - (key_x);	
		}
	}
	
	if(move_y < 0)
	{
		var y_sign = '-';
		var move_y = Math.abs(move_y);
	}
	else
	{
		var y_sign = '+';
	}
	
	if(move_x < 0)
	{
		var x_sign = '+';
		var move_x = Math.abs(move_x);
	}
	else
	{
		var x_sign = '-';
	}
}
```

Dan heb ik 

```javascript
if(move_y < 0)
	{
		var y_sign = '-';
		var move_y = Math.abs(move_y);
	}
	else
	{
		var y_sign = '+';
	}
	
	if(move_x < 0)
	{
		var x_sign = '+';
		var move_x = Math.abs(move_x);
	}
	else
	{
		var x_sign = '-';
	}
}

vervangen door

```javascript
if (move_y < 0) {
                sendMove('ArrowUp')
            }
            else {
                sendMove('ArrowDown')
            }

            if (move_x < 0) {
                sendMove('ArrowRight')
            }
            else {
                sendMove('ArrowLeft')
            }
```

Dit maakt dat de move word doorgegeven met de juiste richting naar de index en is hetzelfde als hoe de pijltjes werken.

Het werkte maar was alleen nog veel te gevoelig, dus heb ik aan ai gevraagd om het niet x en y tegelijk uit te voeren maar te maken dat hij de hene pakt dat het meest getild is om uit te voeren/ door te geven en dat hij minimaal iets moet hebben van tilt voor hij het telt zodat je geen perongelijke zetten doet.

promt:
```javascript
Can you try not to execute x and y simultaneously, but to make sure it picks the one that is tilted the most to execute/pass, and that it requires at least some tilt before counting it, so that you don't make odd moves.
```

output:
Edited
sender.html+23-12
Updated the motion logic to use a minimum tilt threshold and choose only the dominant axis, so you won’t send both X and Y moves or react to tiny jitters. See the updated block in sender.html:74-140.

If you want, I can:

Tune the threshold value to feel more/less sensitive.
Add a short cooldown so repeated tilts don’t spam moves.


Dit werkte al beter maar nog altijd niet perfect, dus heb ik verder gevraagd.

promt:
```javascript
It also reacts when I go back to my phone laying flat for the up and down (the up and down stil don't work that good). Can you make that if I tilt my phone that is is only that way (the way it is most tilted) that reacts and moves? And that if you tilt your phone back to normal it does not react to it?
```

output:
I updated the tilt handling so it only fires when you’re clearly tilted in one dominant direction, and it won’t send a move when you return to neutral. It now resets on neutral and only sends when the direction actually changes. See sender.html:62-144.

If you want it to feel steadier, I can:

Increase the threshold to reduce sensitivity.
Add a small cooldown (e.g. 150–250ms) so it doesn’t spam on shaky hands.


promt:
```javascript
The up stil reacts to fast, can you make sure it only works when i tilt the top of my phone down?
```

output:
Edited
sender.html+2-2
Adjusted the vertical logic so ArrowUp only fires when move_y <= -threshold and ArrowDown only when move_y >= threshold. That prevents small drift or returning to neutral from triggering. See sender.html:100-126.

If ArrowUp now feels reversed, tell me whether your “top of phone down” should move up or down in the maze and I’ll flip it.

--> het bleek dat mijn up en down gedraad stonden voor de gyroscoop dus heeft ai die geswitcht.

Uiteindlijk werkte het nog altijd niet hoe ik wou dus ben ik terug gegaan voor het moment dat ik vroeg om x & y niet tegelijk te laten gaan.

Ik heb dan geprobeerd er een vaste waarde aan te geven van wanneer het zou moeten reageren.

```javascript
if (move_y < -10) {
                sendMove('ArrowUp')
            }
            if (move_y > 10) {
                sendMove('ArrowDown')
            }

            if (move_x < -10) {
                sendMove('ArrowRight')
            }
            if (move_x > 10) {
                sendMove('ArrowLeft')
            }
```

Dit werkte niet. Heb dan geprobeerd aan ai te vragen door gebruik te maken van graden.

promt:
```javascript
Can you make that the sendMove is triggerd when th phone is in a 35degrees different from laying flat? so sendMove('ArrowUp') should be called when the top of the phone is down and the bottom is up, sendMove('ArrowDown') is then the opposed, sendMove('ArrowRight') should be when the right side of the phone is down and the left side up and again sendMove('ArrowLeft') is the opposed.
```

output:
Edited
sender.html+10-33
Updated the motion logic to trigger moves only when pitch or roll exceeds 35 degrees from flat, using the direction mapping you described. The change is in sender.html:74-114.

If the directions feel inverted on your device, tell me which one is reversed and I’ll flip it.


Door nu ook de z-index te gebruiken kan hij het kantelen beter uitvoeren en uitreken. Door het gebruik van de z-index is het mogelijk om de graden van de kanteling uit te reken waardoor het makkelijker is om aan te geven hoe en wat er veranderd is.

Dit werkte redelijk goed, alleen wou ik dat hij toch nog iets minder snel reageerde. Dus heb ik de threshold van 35 graden naar 55 gezet.

## hide qr and reset

Ik wou dat na het connecten van de peer conection dat de qr-code verdeen en dus ook weer verscheen wanneer het disconnecteerde en heb dan direct ook gevraagd om er een refresh op te zetten.

promt:
```javascript
Can you make it so that when the connection is established, the QR code disappears, and when the sender disconnects, the QR code reappears and everything resets from the beginning (this means that the screen looks like it did when no one has connected yet, so no maze yet)?
```

output:
Made the receiver reset to the initial “waiting for scan” state when the sender disconnects. QR hides on connect, reappears on disconnect, and the maze UI is cleared (no maze, no overlays, level indicator reset).

Changes:

Reset helper added in maze.js:160-198
QR hide/show + reset on disconnect in connection.js:6-84
If you want the status text to switch back to “Waiting for sender to scan QR code…” immediately on disconnect, I can adjust that too.

Hier bij werkte het wel goed om de qr-code te doen verdwijnen. Dit was ook een een simple manier gedaan door de display style aan te passen wanneer peer.on connect binnen komt en zo ook terug verschijnt wanneer peer.on close voor de disconect.

De peer.on close krijgt hij gewoon wat later door waardoor het langer duurt maar dit werkt ook! 
De maze reset werkt op ook met peer.on close voor de disconect om te restarten. Het zet zichzelf ook onzichtbaar door de class visible weg te doen en alles in het canvas leeg te zetten.

Zelf heb ik dan de moves weggehaald omdat ik dit eigenlijk niet in het spelletje wil. Dit heb ik gedaan door alles met points te verwijderen en het tekste van moves (je het zoveel moves gedaan).

Ik wou snel al een keer mijn code opschonen en heb dit dan ook aan ai gevraagd om alles te verwijderen dat niet gebruikt wordt, vooral om te zien of ik nog dingen ben vergeten om weg te doen van de points.

promt:
```javascript
Can you remove the code that we don't use anymore, if there is some.
```

output:
Edited
maze.js+0-41
Removed unused maze code (unused state, DFS solver, and legacy helpers) in maze.js.

If you want me to also strip any unused HTML elements or CSS, point me to the file(s) you want trimmed.

Ook heb ik de code voor de levels te bepalen weggehaald omdat ik dat eigenijk niet gebruik. Dat is deze code die ik weg doe:

```javascript
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
            <input id="startMazeBtn" type="button" onclick="makeMaze()" value="New Maze" />
            <span id="levelIndicator"></span>
        </div>
```
Dan heb ik aan AI weer gevraagd om de js en css code weg te doen die alleen met dat had te maken.

promt:
```javascript
Do you want to remove all js code and css code that was only used for: <div id="menu">
<div class="custom-select">
<select id="diffSelect">
<option value="10">Easy</option>
<option value="15">Medium</option>
<option value="25">Hard</option>
<option value="38">Extreme</option>
</select>
</div>
<input id="startMazeBtn" type="button" onclick="makeMaze()" value="New Maze" />
<span id="levelIndicator"></span>
</div>
```

output:
Removed the menu-only JS/CSS now that the menu markup is gone.

JS cleanup in maze.js
CSS cleanup in style.css
If you also want the level system itself removed (3 levels + timing), say the word and I’ll strip that too.

Nu wou ik dat je start aanroept op de gsm ipv op de index.

promt:
```javascript
Would you like to put a button on the transmitter that starts the game only when you press it, and that also allows you to restart? The restart button on the index can also be removed.
```
output:
Added a Start/Restart button on the sender that controls when the maze begins, and removed the receiver’s restart button.

What changed:

Sender now sends a start message; receiver starts/reset the maze only on that signal: sender.html, connection.js
Receiver overlay button removed: index.html
Restart button logic removed from maze code: maze.js
Styles updated for the sender button; old overlay button styles removed: style.css
If you want the status text to say “Press Start on the controller” after connect, I can add that.

De code die eerst automatisch de maze triggerde zit nu achter een button die op de sender staat.

Dan heb ik nog in de css de knoppen op de sender groter gezet.

```javascript
button {
    width: 100px;
    height: 100px;
}
```

Ook zag ik dat ik een media querie had en heb die verwijderd.

