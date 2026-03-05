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


# eerste spel

Ik wil een doolhof als eerste spel. Online zocht ik op hoe ik het best maakte en kwam zo deze tegen:
https://www.geeksforgeeks.org/javascript/navigating-the-labyrinth-a-maze-generator-game-using-html-css-javascript/

Dit heb ik in mijn receiver gestoken.
