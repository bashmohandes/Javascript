(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.TetrisGame = api.TetrisGame;
    root.TetrisRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const WIDTH = 10, VISIBLE_ROWS = 20, HIDDEN_ROWS = 2, HEIGHT = VISIBLE_ROWS + HIDDEN_ROWS;
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
    const cellsFor = piece => SHAPES[piece.type][piece.rotation].map(([x, y]) => [piece.x + x, piece.y + y]);

    class TetrisGame {
        constructor(options = {}) { this.random = options.random || Math.random; this.reset(); }
        reset() {
            this.board = emptyBoard(); this.queue = []; this.holdType = null; this.holdUsed = false; this.piece = null;
            this.score = 0; this.lines = 0; this.level = 1; this.pieces = 0; this.singles = 0; this.doubles = 0; this.triples = 0; this.tetrises = 0;
            this.softDropCells = 0; this.hardDropCells = 0; this.gameOver = false; this.paused = false; this.gravityElapsed = 0; this.lockElapsed = 0; this.lockResets = 0;
            this.clearEventId = 0; this.lastClear = null;
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
        collides(piece) { return cellsFor(piece).some(([x, y]) => x < 0 || x >= WIDTH || y >= HEIGHT || (y >= 0 && this.board[y][x])); }
        grounded(piece = this.piece) { return this.collides({ ...piece, y: piece.y + 1 }); }
        move(dx, dy = 0) {
            if (this.gameOver || this.paused) return false;
            const next = { ...this.piece, x: this.piece.x + dx, y: this.piece.y + dy };
            if (this.collides(next)) return false;
            const wasGrounded = this.grounded(); this.piece = next;
            if (wasGrounded && this.lockResets < 15) { this.lockElapsed = 0; this.lockResets += 1; }
            return true;
        }
        rotate(direction = 1) {
            if (this.gameOver || this.paused || this.piece.type === 'O') return false;
            const from = this.piece.rotation, to = (from + (direction > 0 ? 1 : 3)) % 4;
            const kicks = (this.piece.type === 'I' ? I_KICKS : JLSTZ_KICKS)[`${from}>${to}`] || [[0,0]];
            for (const [dx, dy] of kicks) {
                const next = { ...this.piece, rotation: to, x: this.piece.x + dx, y: this.piece.y + dy };
                if (!this.collides(next)) { const wasGrounded = this.grounded(); this.piece = next; if (wasGrounded && this.lockResets < 15) { this.lockElapsed = 0; this.lockResets += 1; } return true; }
            }
            return false;
        }
        softDrop() { if (this.move(0, 1)) { this.softDropCells += 1; this.score += 1; return true; } return false; }
        ghostY() { let y = this.piece.y; while (!this.collides({ ...this.piece, y: y + 1 })) y += 1; return y; }
        hardDrop() {
            if (this.gameOver || this.paused) return 0;
            const distance = this.ghostY() - this.piece.y; this.piece.y += distance; this.hardDropCells += distance; this.score += distance * 2; this.lock(); return distance;
        }
        hold() {
            if (this.gameOver || this.paused || this.holdUsed) return false;
            const outgoing = this.piece.type, incoming = this.holdType; this.holdType = outgoing; this.holdUsed = true;
            return this.spawn(incoming);
        }
        clearLines() {
            const clearedRows = [];
            this.board.forEach((row, index) => { if (row.every(Boolean)) clearedRows.push(index); });
            const remaining = this.board.filter((row, index) => !clearedRows.includes(index)), cleared = clearedRows.length;
            while (remaining.length < HEIGHT) remaining.unshift(Array(WIDTH).fill(null)); this.board = remaining;
            if (cleared === 1) { this.singles += 1; this.score += 100; }
            if (cleared === 2) { this.doubles += 1; this.score += 300; }
            if (cleared === 3) { this.triples += 1; this.score += 500; }
            if (cleared === 4) { this.tetrises += 1; this.score += 800; }
            this.lines += cleared; this.level = Math.floor(this.lines / 10) + 1;
            if (cleared) this.lastClear = { id: ++this.clearEventId, count: cleared, rows: clearedRows.map(row => row - HIDDEN_ROWS).filter(row => row >= 0) };
            return cleared;
        }
        lock() {
            if (this.gameOver) return 0;
            const cells = cellsFor(this.piece);
            if (cells.some(([, y]) => y < HIDDEN_ROWS)) { this.gameOver = true; return 0; }
            cells.forEach(([x, y]) => { this.board[y][x] = this.piece.type; }); this.pieces += 1;
            const cleared = this.clearLines(); this.holdUsed = false; this.spawn(); return cleared;
        }
        gravityMs() { return Math.max(50, 1000 * Math.pow(.85, this.level - 1)); }
        update(milliseconds) {
            if (this.gameOver || this.paused || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
            this.gravityElapsed += milliseconds;
            while (this.gravityElapsed >= this.gravityMs() && !this.gameOver) { this.gravityElapsed -= this.gravityMs(); if (!this.move(0, 1)) break; }
            if (this.grounded()) { this.lockElapsed += milliseconds; if (this.lockElapsed >= 500) this.lock(); } else this.lockElapsed = 0;
        }
        visibleBoard() { return this.board.slice(HIDDEN_ROWS).map(row => row.slice()); }
        activeCells() { return cellsFor(this.piece).map(([x, y]) => [x, y - HIDDEN_ROWS]); }
        ghostCells() { return cellsFor({ ...this.piece, y: this.ghostY() }).map(([x, y]) => [x, y - HIDDEN_ROWS]); }
        details(seconds) { return { mode: 'marathon', seconds, lines: this.lines, level: this.level, pieces: this.pieces, singles: this.singles, doubles: this.doubles, triples: this.triples, tetrises: this.tetrises, softDropCells: this.softDropCells, hardDropCells: this.hardDropCells }; }
    }

    return { TetrisGame, WIDTH, HEIGHT, HIDDEN_ROWS, VISIBLE_ROWS, TYPES, SHAPES, cellsFor };
});
