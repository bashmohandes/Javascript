(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.TetrisGame = api.TetrisGame;
    root.TetrisRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const WIDTH = 10, VISIBLE_ROWS = 20, HIDDEN_ROWS = 2, HEIGHT = VISIBLE_ROWS + HIDDEN_ROWS;
    const MAGIC_BLOCK_POINTS = 50, DEFAULT_POWER_UP_CHANCE = .1, DEFAULT_POWER_UP_GRACE = 5, DEFAULT_POWER_UP_COOLDOWN = 6;
    const TYPES = Object.freeze(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
    const SHAPES = Object.freeze({
        I: [[[0,1],[1,1],[2,1],[3,1]],[[2,0],[2,1],[2,2],[2,3]],[[0,2],[1,2],[2,2],[3,2]],[[1,0],[1,1],[1,2],[1,3]]],
        J: [[[0,0],[0,1],[1,1],[2,1]],[[1,0],[2,0],[1,1],[1,2]],[[0,1],[1,1],[2,1],[2,2]],[[1,0],[1,1],[0,2],[1,2]]],
        L: [[[2,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[1,2],[2,2]],[[0,1],[1,1],[2,1],[0,2]],[[0,0],[1,0],[1,1],[1,2]]],
        O: [[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]]],
        S: [[[1,0],[2,0],[0,1],[1,1]],[[1,0],[1,1],[2,1],[2,2]],[[1,1],[2,1],[0,2],[1,2]],[[0,0],[0,1],[1,1],[1,2]]],
        T: [[[1,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[2,1],[1,2]],[[0,1],[1,1],[2,1],[1,2]],[[1,0],[0,1],[1,1],[1,2]]],
        Z: [[[0,0],[1,0],[1,1],[2,1]],[[2,0],[1,1],[2,1],[1,2]],[[0,1],[1,1],[1,2],[2,2]],[[1,0],[0,1],[1,1],[0,2]]]
    });
    const JLSTZ_KICKS = Object.freeze({
        '0>1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]], '1>0': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
        '1>2': [[0,0],[1,0],[1,1],[0,-2],[1,-2]], '2>1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
        '2>3': [[0,0],[1,0],[1,-1],[0,2],[1,2]], '3>2': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
        '3>0': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]], '0>3': [[0,0],[1,0],[1,-1],[0,2],[1,2]]
    });
    const I_KICKS = Object.freeze({
        '0>1': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]], '1>0': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
        '1>2': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]], '2>1': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
        '2>3': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]], '3>2': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
        '3>0': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]], '0>3': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]]
    });

    const emptyBoard = () => Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));
    const cellsFor = piece => piece.type === 'M' ? [[piece.x, piece.y]] : SHAPES[piece.type][piece.rotation].map(([x, y]) => [piece.x + x, piece.y + y]);

    class TetrisGame {
        constructor(options = {}) {
            this.random = options.random || Math.random; this.powerUpRandom = options.powerUpRandom || this.random;
            this.powerUpChance = options.powerUpChance ?? DEFAULT_POWER_UP_CHANCE; this.powerUpGrace = options.powerUpGrace ?? DEFAULT_POWER_UP_GRACE; this.powerUpCooldown = options.powerUpCooldown ?? DEFAULT_POWER_UP_COOLDOWN;
            this.reset();
        }
        reset() {
            this.board = emptyBoard(); this.queue = []; this.holdType = null; this.holdUsed = false; this.piece = null;
            this.score = 0; this.lines = 0; this.level = 1; this.pieces = 0; this.singles = 0; this.doubles = 0; this.triples = 0; this.tetrises = 0;
            this.softDropCells = 0; this.hardDropCells = 0; this.gameOver = false; this.paused = false; this.gravityElapsed = 0; this.lockElapsed = 0; this.lockResets = 0;
            this.magicPowerUps = 0; this.magicBlocksDestroyed = 0; this.shakePowerUps = 0; this.shakeReady = false; this.lastPowerUpPiece = -Infinity;
            this.clearEventId = 0; this.destructionEventId = 0; this.compactionEventId = 0; this.powerUpEventId = 0; this.lastClear = null; this.lastDestruction = null; this.lastCompaction = null; this.lastPowerUp = null;
            this.fillQueue(); this.spawn();
        }
        fillQueue() {
            while (this.queue.length < 7) {
                const bag = TYPES.slice();
                for (let index = bag.length - 1; index > 0; index -= 1) { const other = Math.floor(this.random() * (index + 1)); [bag[index], bag[other]] = [bag[other], bag[index]]; }
                this.queue.push(...bag);
            }
        }
        spawn(type = null) {
            if (!type) { this.fillQueue(); type = this.queue.shift(); this.fillQueue(); }
            this.piece = { type, rotation: 0, x: 3, y: 0 };
            this.gravityElapsed = 0; this.lockElapsed = 0; this.lockResets = 0;
            if (this.collides(this.piece)) this.gameOver = true;
            return !this.gameOver;
        }
        isMagic(piece = this.piece) { return piece?.type === 'M'; }
        collides(piece) { return cellsFor(piece).some(([x, y]) => x < 0 || x >= WIDTH || y >= HEIGHT || (!this.isMagic(piece) && y >= 0 && this.board[y][x])); }
        grounded(piece = this.piece) { return this.collides({ ...piece, y: piece.y + 1 }); }
        destroyMagicCells(positions) {
            const destroyed = [];
            positions.forEach(([x, y]) => {
                if (y >= 0 && y < HEIGHT && this.board[y][x]) { destroyed.push({ x, y: y - HIDDEN_ROWS, type: this.board[y][x] }); this.board[y][x] = null; }
            });
            if (destroyed.length) {
                this.magicBlocksDestroyed += destroyed.length; this.score += destroyed.length * MAGIC_BLOCK_POINTS;
                this.lastDestruction = { id: ++this.destructionEventId, cells: destroyed, count: destroyed.length, points: destroyed.length * MAGIC_BLOCK_POINTS };
            }
            return destroyed.length;
        }
        move(dx, dy = 0) {
            if (this.gameOver || this.paused || this.shakeReady) return false;
            const next = { ...this.piece, x: this.piece.x + dx, y: this.piece.y + dy };
            if (this.collides(next)) return false;
            const wasGrounded = this.grounded(); this.piece = next; if (this.isMagic()) this.destroyMagicCells(cellsFor(this.piece));
            if (wasGrounded && this.lockResets < 15) { this.lockElapsed = 0; this.lockResets += 1; }
            if (this.isMagic() && dy > 0 && this.grounded()) this.finishMagic();
            return true;
        }
        rotate(direction = 1) {
            if (this.gameOver || this.paused || this.shakeReady || this.isMagic() || this.piece.type === 'O') return false;
            const from = this.piece.rotation, to = (from + (direction > 0 ? 1 : 3)) % 4;
            const kicks = (this.piece.type === 'I' ? I_KICKS : JLSTZ_KICKS)[`${from}>${to}`] || [[0,0]];
            for (const [dx, dy] of kicks) {
                const next = { ...this.piece, rotation: to, x: this.piece.x + dx, y: this.piece.y + dy };
                if (!this.collides(next)) { const wasGrounded = this.grounded(); this.piece = next; if (wasGrounded && this.lockResets < 15) { this.lockElapsed = 0; this.lockResets += 1; } return true; }
            }
            return false;
        }
        softDrop() { const magic = this.isMagic(); if (this.move(0, 1)) { if (!magic) { this.softDropCells += 1; this.score += 1; } return true; } return false; }
        ghostY() { let y = this.piece.y; while (!this.collides({ ...this.piece, y: y + 1 })) y += 1; return y; }
        hardDrop() {
            if (this.gameOver || this.paused || this.shakeReady) return 0;
            const distance = this.ghostY() - this.piece.y;
            if (this.isMagic()) {
                const positions = Array.from({ length: distance }, (_, index) => [this.piece.x, this.piece.y + index + 1]);
                this.piece.y += distance; this.destroyMagicCells(positions); this.finishMagic(); return distance;
            }
            this.piece.y += distance; this.hardDropCells += distance; this.score += distance * 2; this.lock(); return distance;
        }
        hold() {
            if (this.gameOver || this.paused || this.shakeReady || this.isMagic() || this.holdUsed) return false;
            const outgoing = this.piece.type, incoming = this.holdType; this.holdType = outgoing; this.holdUsed = true;
            return this.spawn(incoming);
        }
        clearLines(source = 'piece') {
            const clearedRows = [];
            this.board.forEach((row, index) => { if (row.every(Boolean)) clearedRows.push(index); });
            const remaining = this.board.filter((row, index) => !clearedRows.includes(index)), cleared = clearedRows.length;
            while (remaining.length < HEIGHT) remaining.unshift(Array(WIDTH).fill(null)); this.board = remaining;
            const fourLineClears = Math.floor(cleared / 4), remainder = cleared % 4;
            this.tetrises += fourLineClears; this.score += fourLineClears * 800;
            if (remainder === 1) { this.singles += 1; this.score += 100; }
            if (remainder === 2) { this.doubles += 1; this.score += 300; }
            if (remainder === 3) { this.triples += 1; this.score += 500; }
            this.lines += cleared; this.level = Math.floor(this.lines / 10) + 1;
            if (cleared) {
                this.lastClear = { id: ++this.clearEventId, count: cleared, rows: clearedRows.map(row => row - HIDDEN_ROWS).filter(row => row >= 0) };
                if (source !== 'piece') this.lastClear.source = source;
            }
            return cleared;
        }
        rollPowerUp() {
            if (this.powerUpChance <= 0 || this.pieces < this.powerUpGrace || this.pieces - this.lastPowerUpPiece < this.powerUpCooldown || this.powerUpRandom() >= this.powerUpChance) return null;
            return this.powerUpRandom() < .5 ? 'magic' : 'shake';
        }
        triggerPowerUp(type) {
            if (this.gameOver || !['magic','shake'].includes(type)) return false;
            this.lastPowerUpPiece = this.pieces;
            if (type === 'magic') {
                this.magicPowerUps += 1; this.piece = { type: 'M', rotation: 0, x: Math.floor(this.powerUpRandom() * WIDTH), y: HIDDEN_ROWS };
                this.gravityElapsed = 0; this.lockElapsed = 0; this.lockResets = 0; this.destroyMagicCells(cellsFor(this.piece));
            } else {
                if (!this.spawn()) return false; this.shakeReady = true;
            }
            this.lastPowerUp = { id: ++this.powerUpEventId, type }; return true;
        }
        finishMagic() { if (!this.isMagic()) return false; this.holdUsed = false; return this.spawn(); }
        compactBoard() {
            const compacted = emptyBoard(), moved = [];
            for (let x = 0; x < WIDTH; x += 1) {
                const blocks = [];
                for (let y = HEIGHT - 1; y >= 0; y -= 1) if (this.board[y][x]) blocks.push({ from: y, type: this.board[y][x] });
                blocks.forEach(({ from, type }, index) => {
                    const to = HEIGHT - 1 - index; compacted[to][x] = type;
                    if (from !== to && to >= HIDDEN_ROWS) moved.push({ x, from: from - HIDDEN_ROWS, to: to - HIDDEN_ROWS, type });
                });
            }
            this.board = compacted; return moved;
        }
        useShake() {
            if (this.gameOver || this.paused || !this.shakeReady) return null;
            const moved = this.compactBoard(); this.shakeReady = false; this.shakePowerUps += 1;
            const cleared = this.clearLines('shake'); this.lastCompaction = { id: ++this.compactionEventId, moved, count: moved.length, cleared };
            this.gravityElapsed = 0; this.lockElapsed = 0; return this.lastCompaction;
        }
        lock() {
            if (this.gameOver) return 0;
            if (this.isMagic()) { this.finishMagic(); return 0; }
            const cells = cellsFor(this.piece);
            if (cells.some(([, y]) => y < HIDDEN_ROWS)) { this.gameOver = true; return 0; }
            cells.forEach(([x, y]) => { this.board[y][x] = this.piece.type; }); this.pieces += 1;
            const cleared = this.clearLines(); this.holdUsed = false; const powerUp = this.rollPowerUp(); if (powerUp) this.triggerPowerUp(powerUp); else this.spawn(); return cleared;
        }
        gravityMs() { return this.isMagic() ? 240 : Math.max(50, 1000 * Math.pow(.85, this.level - 1)); }
        update(milliseconds) {
            if (this.gameOver || this.paused || this.shakeReady || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
            this.gravityElapsed += milliseconds;
            while (this.gravityElapsed >= this.gravityMs() && !this.gameOver) { this.gravityElapsed -= this.gravityMs(); if (!this.move(0, 1)) break; }
            if (this.grounded()) { this.lockElapsed += milliseconds; if (this.lockElapsed >= 500) this.lock(); } else this.lockElapsed = 0;
        }
        visibleBoard() { return this.board.slice(HIDDEN_ROWS).map(row => row.slice()); }
        activeCells() { return cellsFor(this.piece).map(([x, y]) => [x, y - HIDDEN_ROWS]); }
        ghostCells() { return this.isMagic() ? [] : cellsFor({ ...this.piece, y: this.ghostY() }).map(([x, y]) => [x, y - HIDDEN_ROWS]); }
        details(seconds) { return { mode: 'marathon', seconds, lines: this.lines, level: this.level, pieces: this.pieces, singles: this.singles, doubles: this.doubles, triples: this.triples, tetrises: this.tetrises, softDropCells: this.softDropCells, hardDropCells: this.hardDropCells, magicPowerUps: this.magicPowerUps, magicBlocksDestroyed: this.magicBlocksDestroyed, shakePowerUps: this.shakePowerUps }; }
    }

    return { TetrisGame, WIDTH, HEIGHT, HIDDEN_ROWS, VISIBLE_ROWS, TYPES, SHAPES, MAGIC_BLOCK_POINTS, cellsFor };
});
