(() => {
    'use strict';

    const LEVELS = { easy: { rows: 9, columns: 9, mines: 10 }, medium: { rows: 16, columns: 16, mines: 40 }, hard: { rows: 16, columns: 30, mines: 99 } };
    const boardElement = document.querySelector('#board');
    const difficultyElement = document.querySelector('#difficulty');
    const minesElement = document.querySelector('#mines-left');
    const timerElement = document.querySelector('#timer');
    const bestElement = document.querySelector('#best-time');
    const statusElement = document.querySelector('#status');
    const flagButton = document.querySelector('#flag-mode');
    const modal = document.querySelector('#finish-modal');
    const shareButton = document.querySelector('#share-result');
    const events = window.ArcadeEvents;
    const saves = window.Arcade?.saves;
    let cells = [], level, started, ended, elapsed, timerId, flagMode, focusedIndex, pressTimer, longPressed, lastResultWon;

    const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const neighboursOf = index => {
        const row = Math.floor(index / level.columns), column = index % level.columns, neighbours = [];
        for (let rowOffset = -1; rowOffset <= 1; rowOffset++) for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
            const nextRow = row + rowOffset, nextColumn = column + columnOffset;
            if ((rowOffset || columnOffset) && nextRow >= 0 && nextRow < level.rows && nextColumn >= 0 && nextColumn < level.columns) neighbours.push(nextRow * level.columns + nextColumn);
        }
        return neighbours;
    };

    function startGame() {
        saves?.startRun();
        level = LEVELS[difficultyElement.value];
        cells = Array.from({ length: level.rows * level.columns }, () => ({ mine: false, revealed: false, flagged: false, count: 0 }));
        started = false; ended = false; elapsed = 0; flagMode = false; focusedIndex = 0; lastResultWon = null;
        clearInterval(timerId); timerElement.textContent = '00:00'; modal.hidden = true;
        flagButton.setAttribute('aria-pressed', 'false'); flagButton.querySelector('small').textContent = 'Off';
        statusElement.textContent = 'Choose any tile to begin. Your first move is always safe.';
        boardElement.style.setProperty('--columns', level.columns); boardElement.style.setProperty('--rows', level.rows); boardElement.setAttribute('aria-rowcount', level.rows); boardElement.setAttribute('aria-colcount', level.columns);
        events.emit('game:started', { intensity: .08, danger: 0, difficulty: difficultyElement.value });
        updateBest(); render();
    }

    function placeMines(firstIndex) {
        const protectedCells = new Set([firstIndex, ...neighboursOf(firstIndex)]);
        const available = cells.map((_, index) => index).filter(index => !protectedCells.has(index));
        for (let index = available.length - 1; index > 0; index--) { const swap = Math.floor(Math.random() * (index + 1)); [available[index], available[swap]] = [available[swap], available[index]]; }
        available.slice(0, level.mines).forEach(index => { cells[index].mine = true; });
        cells.forEach((cell, index) => { cell.count = neighboursOf(index).filter(neighbour => cells[neighbour].mine).length; });
        started = true; timerId = setInterval(() => { elapsed++; timerElement.textContent = formatTime(elapsed); }, 1000);
    }

    function reveal(index) {
        if (ended || cells[index].flagged || cells[index].revealed) return;
        if (!started) placeMines(index);
        saves?.markDirty();
        if (cells[index].mine) { cells[index].revealed = true; endGame(false, index); return; }
        const revealedBefore = cells.filter(cell => cell.revealed).length;

        // Reveal empty regions in one pass. Recursively calling reveal used to
        // rebuild the entire board once per cleared cell, which was especially
        // expensive on the 30-column field and could also run win checks while
        // a flood fill was still in progress.
        const pending = [index];
        const queued = new Set(pending);
        while (pending.length) {
            const currentIndex = pending.pop();
            const cell = cells[currentIndex];
            if (cell.revealed || cell.flagged || cell.mine) continue;
            cell.revealed = true;
            if (!cell.count) neighboursOf(currentIndex).forEach(neighbour => {
                if (!queued.has(neighbour) && !cells[neighbour].revealed && !cells[neighbour].flagged && !cells[neighbour].mine) {
                    queued.add(neighbour);
                    pending.push(neighbour);
                }
            });
        }
        const revealedCount = cells.filter(cell => cell.revealed).length - revealedBefore;
        events.emit('minesweeper:cells-revealed', { count: revealedCount });
        const safeCells = cells.length - level.mines;
        events.emit('game:progressed', { progress: cells.filter(cell => cell.revealed).length / safeCells, intensity: .12 + cells.filter(cell => cell.revealed).length / safeCells * .62, danger: 0 });
        statusElement.textContent = 'The field is opening up. Keep going.';
        if (cells.every(item => item.mine || item.revealed)) endGame(true);
        else render();
    }

    function toggleFlag(index) {
        if (ended || cells[index].revealed) return;
        cells[index].flagged = !cells[index].flagged;
        saves?.markDirty();
        events.emit('minesweeper:flag-changed', { index, flagged: cells[index].flagged });
        statusElement.textContent = cells[index].flagged ? 'Mine marked.' : 'Flag removed.';
        render();
    }

    function activate(index) { flagMode ? toggleFlag(index) : reveal(index); }
    function endGame(won, explodedIndex) {
        ended = true; lastResultWon = won; clearInterval(timerId);
        saves?.completeRun();
        if (!won) events.emit('minesweeper:mine-triggered', { index: explodedIndex, damage: 50 });
        events.emit('game:completed', { outcome: won ? 'win' : 'loss', seconds: elapsed });
        const difficulty = difficultyElement.value;
        window.Arcade?.record({ game: 'minesweeper', won, details: { difficulty, seconds: elapsed } }).catch(() => {});
        if (!won) cells.forEach((cell, index) => { if (cell.mine) cell.revealed = true; if (index === explodedIndex) cell.exploded = true; });
        if (won) {
            cells.forEach(cell => { if (cell.mine) cell.flagged = true; });
            const key = `minesweeper-best-${difficultyElement.value}`, previous = Number(localStorage.getItem(key));
            if (!previous || elapsed < previous) localStorage.setItem(key, elapsed);
        }
        statusElement.textContent = won ? 'Every safe tile is clear.' : 'A mine was hiding there. Ready to try again?';
        document.querySelector('#finish-label').textContent = won ? 'Field cleared' : 'Mine found';
        document.querySelector('#finish-title').textContent = won ? 'Beautifully done.' : 'So close.';
        document.querySelector('#finish-summary').textContent = won ? `You cleared the field in ${formatTime(elapsed)}.` : 'The next field is waiting when you are.';
        document.querySelector('#result-icon').textContent = won ? '✦' : '✹';
        updateBest(); render(); modal.hidden = false; shareButton.focus();
    }

    async function shareResult() {
        if (lastResultWon === null) return;
        const difficulty = difficultyElement.value;
        const difficultyName = difficulty[0].toUpperCase() + difficulty.slice(1);
        const caption = lastResultWon
            ? `I cleared a ${difficulty} Minesweeper field in ${formatTime(elapsed)}!`
            : `I took on a ${difficulty} Minesweeper field in JS Arcade.`;
        shareButton.disabled = true;
        try {
            const image = window.ResultShare.minesweeper({ cells, rows: level.rows, columns: level.columns, difficulty: difficultyName, time: formatTime(elapsed), won: lastResultWon });
            const result = await window.ResultShare.share({ image, filename: 'js-arcade-minesweeper.png', title: 'My Minesweeper result', text: caption });
            if (result === 'downloaded-copy') shareButton.textContent = 'Image saved · caption copied';
            else if (result === 'downloaded') shareButton.textContent = 'Image saved';
        } catch (error) { if (error.name !== 'AbortError') shareButton.textContent = 'Could not share'; }
        finally { shareButton.disabled = false; setTimeout(() => { shareButton.textContent = 'Share result'; }, 2600); }
    }

    function updateBest() { const best = Number(localStorage.getItem(`minesweeper-best-${difficultyElement.value}`)); bestElement.textContent = best ? formatTime(best) : '—'; }
    function render() {
        boardElement.replaceChildren();
        cells.forEach((cell, index) => {
            const button = document.createElement('button'), row = Math.floor(index / level.columns), column = index % level.columns;
            button.type = 'button'; button.className = 'cell'; button.dataset.index = index; button.tabIndex = index === focusedIndex ? 0 : -1;
            button.setAttribute('role', 'gridcell'); button.setAttribute('aria-rowindex', row + 1); button.setAttribute('aria-colindex', column + 1);
            if (cell.revealed) button.classList.add('revealed');
            if (cell.flagged) { button.classList.add('flagged'); button.textContent = '⚑'; }
            else if (cell.revealed && cell.mine) { button.classList.add('mine'); button.textContent = '✹'; }
            else if (cell.revealed && cell.count) { button.textContent = cell.count; button.dataset.count = cell.count; }
            if (cell.exploded) button.classList.add('exploded');
            const state = cell.flagged ? 'flagged' : cell.revealed ? (cell.mine ? 'mine' : cell.count ? `${cell.count} nearby mines` : 'clear') : 'hidden';
            button.setAttribute('aria-label', `Row ${row + 1}, column ${column + 1}, ${state}`);
            button.addEventListener('click', () => { if (!longPressed) activate(index); longPressed = false; });
            button.addEventListener('contextmenu', event => { event.preventDefault(); toggleFlag(index); });
            button.addEventListener('pointerdown', event => { if (event.pointerType !== 'mouse') { longPressed = false; pressTimer = setTimeout(() => { longPressed = true; toggleFlag(index); navigator.vibrate?.(30); }, 500); } });
            ['pointerup','pointercancel','pointerleave'].forEach(type => button.addEventListener(type, () => clearTimeout(pressTimer)));
            boardElement.append(button);
        });
        minesElement.textContent = Math.max(0, level.mines - cells.filter(cell => cell.flagged).length);
    }

    boardElement.addEventListener('keydown', event => {
        let next = focusedIndex;
        if (event.key === 'ArrowLeft') next--; else if (event.key === 'ArrowRight') next++; else if (event.key === 'ArrowUp') next -= level.columns; else if (event.key === 'ArrowDown') next += level.columns;
        else if (event.key.toLowerCase() === 'f') { toggleFlag(focusedIndex); return; } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(focusedIndex); return; } else return;
        event.preventDefault(); focusedIndex = Math.max(0, Math.min(cells.length - 1, next)); render(); boardElement.querySelector(`[data-index="${focusedIndex}"]`).focus();
    });
    boardElement.addEventListener('focusin', event => { if (event.target.dataset.index) focusedIndex = Number(event.target.dataset.index); });
    flagButton.addEventListener('click', () => { flagMode = !flagMode; flagButton.setAttribute('aria-pressed', flagMode); flagButton.querySelector('small').textContent = flagMode ? 'On' : 'Off'; });
    difficultyElement.addEventListener('change', startGame);
    ['#new-game', '#new-game-top', '#play-again'].forEach(selector => document.querySelector(selector).addEventListener('click', startGame));
    shareButton.addEventListener('click', shareResult);
    saves?.registerAdapter({
        stateVersion: 1,
        canSave: () => !ended,
        hasProgress: () => started || elapsed > 0 || cells.some(cell => cell.flagged),
        pause: () => { const running = started && !ended && Boolean(timerId); clearInterval(timerId); timerId = null; return running; },
        resume: running => { if (running && started && !ended && !timerId) timerId = setInterval(() => { elapsed++; timerElement.textContent = formatTime(elapsed); }, 1000); },
        capture: async () => ({ mode: difficultyElement.value, elapsedSeconds: elapsed, scoreLabel: `${cells.filter(cell => cell.revealed && !cell.mine).length} cleared`, state: { difficulty: difficultyElement.value, cells, started, elapsed, flagMode, focusedIndex } }),
        restore: async state => {
            const restoredLevel = LEVELS[state?.difficulty];
            if (!restoredLevel || !Array.isArray(state.cells) || state.cells.length !== restoredLevel.rows * restoredLevel.columns || !Number.isInteger(state.elapsed) || state.elapsed < 0 || !Number.isInteger(state.focusedIndex) || state.focusedIndex < 0 || state.focusedIndex >= state.cells.length) throw new Error('This Minesweeper save is invalid or incompatible.');
            const restored = state.cells.map(cell => {
                if (!cell || typeof cell.mine !== 'boolean' || typeof cell.revealed !== 'boolean' || typeof cell.flagged !== 'boolean' || !Number.isInteger(cell.count) || cell.count < 0 || cell.count > 8 || cell.revealed && cell.flagged) throw new Error('This Minesweeper save is invalid or incompatible.');
                return { mine: cell.mine, revealed: cell.revealed, flagged: cell.flagged, count: cell.count };
            });
            clearInterval(timerId); difficultyElement.value = state.difficulty; level = restoredLevel; cells = restored; started = Boolean(state.started); ended = false; elapsed = state.elapsed; flagMode = Boolean(state.flagMode); focusedIndex = state.focusedIndex; lastResultWon = null; timerElement.textContent = formatTime(elapsed); modal.hidden = true; flagButton.setAttribute('aria-pressed', String(flagMode)); flagButton.querySelector('small').textContent = flagMode ? 'On' : 'Off'; boardElement.style.setProperty('--columns', level.columns); boardElement.style.setProperty('--rows', level.rows); boardElement.setAttribute('aria-rowcount', level.rows); boardElement.setAttribute('aria-colcount', level.columns); statusElement.textContent = 'Saved minefield loaded.'; updateBest(); render(); if (started) timerId = setInterval(() => { elapsed++; timerElement.textContent = formatTime(elapsed); }, 1000);
        },
        thumbnail: captured => saves.helpers.makeCanvas(context => {
            const { cells: savedCells, difficulty } = captured.state, dimensions = LEVELS[difficulty], cellSize = Math.min(420 / dimensions.columns, 218 / dimensions.rows), width = cellSize * dimensions.columns, height = cellSize * dimensions.rows, left = 480 - width - 18, top = (270 - height) / 2;
            context.fillStyle='#f7f3eb';context.fillRect(0,0,480,270);context.fillStyle='#20352f';context.font='700 19px system-ui';context.fillText('MINESWEEPER',18,34);context.font='600 14px system-ui';context.fillText(`${difficulty} · ${formatTime(captured.elapsedSeconds)}`,18,64);
            savedCells.forEach((cell,index)=>{const x=left+(index%dimensions.columns)*cellSize,y=top+Math.floor(index/dimensions.columns)*cellSize;context.fillStyle=cell.revealed?'#fffaf0':cell.flagged?'#f5d9cb':'#a9c9b5';context.fillRect(x+1,y+1,Math.max(1,cellSize-2),Math.max(1,cellSize-2));if(cell.flagged){context.fillStyle='#d76b45';context.fillRect(x+cellSize*.35,y+cellSize*.25,Math.max(2,cellSize*.18),Math.max(2,cellSize*.5));}else if(cell.revealed&&cell.count){context.fillStyle='#20352f';context.font=`700 ${Math.max(7,cellSize*.6)}px system-ui`;context.textAlign='center';context.fillText(cell.count,x+cellSize/2,y+cellSize*.72);context.textAlign='left';}});
        })
    });
    startGame();
})();
