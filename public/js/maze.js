/**
 * maze.js – Generates and renders a random maze on a <canvas>.
 * Exposes global helpers so connection.js can call them.
 */

/* ── DOM refs ── */
const canvas  = document.getElementById('mazeCanvas');
const pen     = canvas.getContext('2d');
const $moves  = document.getElementById('moves');

/* ── State ── */
let cols, rows, cellSize;
let cells         = [];
let generatedMaze = [];
let solutionPath  = [];
let trail         = [];
let points        = 0;
let mazeReady     = false;

const player = { x: 0, y: 0, color: '#e94560' };
const finish = { color: '#53d769' };

/* ── Cell class ── */
class Cell {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.visited = false;
        this.walls = { top: true, right: true, bottom: true, left: true };
    }

    draw() {
        const x = this.x * cellSize;
        const y = this.y * cellSize;
        pen.strokeStyle = '#0f3460';
        pen.lineWidth   = 3;
        pen.lineCap     = 'round';

        pen.beginPath();
        if (this.walls.top)    { pen.moveTo(x, y);                 pen.lineTo(x + cellSize, y); }
        if (this.walls.right)  { pen.moveTo(x + cellSize, y);      pen.lineTo(x + cellSize, y + cellSize); }
        if (this.walls.bottom) { pen.moveTo(x + cellSize, y + cellSize); pen.lineTo(x, y + cellSize); }
        if (this.walls.left)   { pen.moveTo(x, y + cellSize);      pen.lineTo(x, y); }
        pen.stroke();
    }
}

/* ── Maze generation (recursive back-tracker) ── */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function carve(x, y) {
    cells[x][y].visited = true;
    const dirs = shuffle(['top', 'right', 'bottom', 'left']);
    const dx = { top: 0, right: 1, bottom: 0, left: -1 };
    const dy = { top: -1, right: 0, bottom: 1, left: 0 };
    const opp = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' };

    for (const d of dirs) {
        const nx = x + dx[d], ny = y + dy[d];
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !cells[nx][ny].visited) {
            cells[x][y].walls[d] = false;
            cells[nx][ny].walls[opp[d]] = false;
            carve(nx, ny);
        }
    }
}

/* ── Solve maze (DFS) to validate moves ── */
function solveMaze() {
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const path = [];

    function dfs(x, y) {
        if (x < 0 || x >= cols || y < 0 || y >= rows || visited[y][x]) return false;
        visited[y][x] = true;
        path.push({ x, y });
        if (x === cols - 1 && y === rows - 1) return true;
        const c = generatedMaze[x][y];
        if (!c.walls.top    && dfs(x, y - 1)) return true;
        if (!c.walls.right  && dfs(x + 1, y)) return true;
        if (!c.walls.bottom && dfs(x, y + 1)) return true;
        if (!c.walls.left   && dfs(x - 1, y)) return true;
        path.pop();
        return false;
    }

    dfs(0, 0);
    return path;
}

/* ── Public: build a new maze ── */
function makeMaze() {
    const sel = document.getElementById('diffSelect');
    const size = sel ? parseInt(sel.value, 10) : 10;

    cellSize = Math.floor(canvas.width / size);
    cols = size;
    rows = size;

    // Reset
    cells = [];
    for (let x = 0; x < cols; x++) {
        cells[x] = [];
        for (let y = 0; y < rows; y++) {
            cells[x][y] = new Cell(x, y);
        }
    }

    carve(0, 0);
    generatedMaze = cells.map(row => row.map(c => ({ ...c })));
    solutionPath  = solveMaze();

    player.x = 0;
    player.y = 0;
    points   = 0;
    trail    = [];
    mazeReady = true;

    drawMaze();
}

/* ── Drawing ── */
function drawMaze() {
    pen.clearRect(0, 0, canvas.width, canvas.height);

    // cells
    for (let x = 0; x < cols; x++)
        for (let y = 0; y < rows; y++)
            cells[x][y].draw();

    // trail
    if (trail.length) {
        pen.beginPath();
        trail.forEach((t, i) => {
            const tx = t.x * cellSize + cellSize / 2;
            const ty = t.y * cellSize + cellSize / 2;
            i === 0 ? pen.moveTo(tx, ty) : pen.lineTo(tx, ty);
        });
        pen.strokeStyle = 'rgba(233,69,96,0.35)';
        pen.lineWidth   = 4;
        pen.lineCap     = 'round';
        pen.stroke();
    }

    // finish
    const fx = (cols - 1) * cellSize + cellSize / 2;
    const fy = (rows - 1) * cellSize + cellSize / 2;
    pen.beginPath();
    pen.arc(fx, fy, cellSize / 2 - 6, 0, Math.PI * 2);
    pen.fillStyle = finish.color;
    pen.fill();

    // player
    const px = player.x * cellSize + cellSize / 2;
    const py = player.y * cellSize + cellSize / 2;
    pen.beginPath();
    pen.arc(px, py, cellSize / 2 - 6, 0, Math.PI * 2);
    pen.fillStyle = player.color;
    pen.fill();
}

/* ── Public: move player (called from connection.js) ── */
function movePlayer(direction) {
    if (!mazeReady) return;

    const c = cells[player.x][player.y];
    let moved = false;

    switch (direction) {
        case 'ArrowUp':    if (player.y > 0        && !c.walls.top)    { player.y--; moved = true; } break;
        case 'ArrowDown':  if (player.y < rows - 1 && !c.walls.bottom) { player.y++; moved = true; } break;
        case 'ArrowLeft':  if (player.x > 0        && !c.walls.left)   { player.x--; moved = true; } break;
        case 'ArrowRight': if (player.x < cols - 1 && !c.walls.right)  { player.x++; moved = true; } break;
    }

    if (!moved) return;
    points++;
    trail.push({ x: player.x, y: player.y });
    drawMaze();

    // Win check
    if (player.x === cols - 1 && player.y === rows - 1) {
        if ($moves) $moves.textContent = `Moves: ${points}`;
        const overlay = document.getElementById('Message-Container');
        if (overlay) overlay.classList.add('visible');
    }
}

/* ── Victory overlay toggle ── */
function toggleVisablity(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
}
