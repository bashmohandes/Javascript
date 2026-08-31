(() => {
    'use strict';
    const game = new window.TetrisGame();
    const boardElement = document.querySelector('#board'), scoreElement = document.querySelector('#score'), linesElement = document.querySelector('#lines'), levelElement = document.querySelector('#level'), bestElement = document.querySelector('#best');
    const statusElement = document.querySelector('#status'), finishElement = document.querySelector('#finish'), pauseButton = document.querySelector('#pause'), shareButton = document.querySelector('#share-result');
    const stageElement = document.querySelector('.tetris-stage'), clearEffectElement = document.querySelector('#line-clear-effect'), clearStreaksElement = document.querySelector('#clear-streaks'), clearBurstElement = document.querySelector('#clear-burst'), clearMultiplierElement = document.querySelector('#clear-multiplier'), recordCalloutElement = document.querySelector('#record-callout');
    const cells = Array.from({ length: 200 }, () => { const cell = document.createElement('span'); cell.className = 'tetris-cell'; boardElement.append(cell); return cell; });
    let activeMilliseconds = 0, lastFrame = performance.now(), submitted = false, themeColors = {}, miniatureSignature = '', presentedClearId = 0, clearEffectTimer = 0, recordTimer = 0, standingBest = Number(localStorage.getItem('tetris-best-score')) || 0, liveBest = standingBest, recordBroken = false;
    const tokenNames = ['board','grid','border','empty','ghost','ghost-line','ink','panel','overlay','shadow','piece-edge','i','j','l','o','s','t','z'];
    const formatTime = total => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    const seconds = () => Math.max(1, Math.floor(activeMilliseconds / 1000));

    function updateTetrisTheme() {
        const styles = getComputedStyle(boardElement);
        themeColors = Object.fromEntries(tokenNames.map(name => [name, styles.getPropertyValue(`--tetris-${name}`).trim()]));
    }
    function mini(type) {
        const element = document.createElement('div'); element.className = 'mini-board';
        const occupied = new Set(type ? window.TetrisRules.SHAPES[type][0].map(([x,y]) => `${x},${y}`) : []);
        for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) { const cell = document.createElement('span'); cell.className = 'mini-cell'; if (occupied.has(`${x},${y}`)) cell.dataset.piece = type; element.append(cell); }
        return element;
    }
    function renderMiniatures() {
        const signature = `${game.holdType || '-'}:${game.queue.slice(0, 5).join('')}`;
        if (signature === miniatureSignature) return; miniatureSignature = signature;
        const hold = document.querySelector('#hold'); hold.replaceChildren(...mini(game.holdType).childNodes); hold.setAttribute('aria-label', game.holdType ? `Held ${game.holdType} piece` : 'No held piece');
        const next = document.querySelector('#next'); next.replaceChildren(...game.queue.slice(0, 5).map(mini)); next.setAttribute('aria-label', `Next pieces: ${game.queue.slice(0, 5).join(', ')}`);
    }
    function presentLineClear() {
        const clear = game.lastClear;
        if (!clear || clear.id === presentedClearId) return;
        presentedClearId = clear.id; stageElement.dataset.clearIntensity = clear.count; clearMultiplierElement.textContent = `x${clear.count}`;
        clearStreaksElement.replaceChildren(...clear.rows.map((row, index) => {
            const streak = document.createElement('span'); streak.className = 'clear-streak'; streak.style.setProperty('--clear-row', row); streak.style.setProperty('--clear-delay', `${index * 32}ms`); return streak;
        }));
        clearBurstElement.replaceChildren(...Array.from({ length: 24 + clear.count * 8 }, (_, index) => {
            const spark = document.createElement('i'); spark.style.setProperty('--spark-angle', `${index * 137.5}deg`); spark.style.setProperty('--spark-distance', `${75 + index % 7 * 13 + clear.count * 12}px`); spark.style.setProperty('--spark-delay', `${index % 6 * 18}ms`); return spark;
        }));
        stageElement.classList.remove('is-clearing'); clearEffectElement.classList.remove('is-active'); void clearEffectElement.offsetWidth;
        stageElement.classList.add('is-clearing'); clearEffectElement.classList.add('is-active');
        clearTimeout(clearEffectTimer); clearEffectTimer = setTimeout(() => { stageElement.classList.remove('is-clearing'); clearEffectElement.classList.remove('is-active'); }, 1250);
        statusElement.textContent = `${clear.count} line${clear.count === 1 ? '' : 's'} cleared · x${clear.count}`;
    }
    function celebrateHighScore() {
        recordBroken = true; stageElement.classList.remove('is-new-record'); recordCalloutElement.classList.remove('is-active'); void recordCalloutElement.offsetWidth;
        stageElement.classList.add('is-new-record'); recordCalloutElement.classList.add('is-active'); document.querySelector('.best-stat').classList.add('is-record');
        statusElement.textContent = `New high score: ${game.score.toLocaleString()}!`;
        clearTimeout(recordTimer); recordTimer = setTimeout(() => { stageElement.classList.remove('is-new-record'); recordCalloutElement.classList.remove('is-active'); }, 2200);
    }
    function render() {
        const board = game.visibleBoard(), active = new Map(game.activeCells().filter(([,y]) => y >= 0).map(([x,y]) => [`${x},${y}`, game.piece.type])), ghost = new Set(game.ghostCells().filter(([,y]) => y >= 0).map(([x,y]) => `${x},${y}`));
        cells.forEach((cell, index) => {
            const x = index % 10, y = Math.floor(index / 10), type = active.get(`${x},${y}`) || board[y][x];
            cell.className = `tetris-cell${!type && ghost.has(`${x},${y}`) ? ' ghost' : ''}`;
            if (type) cell.dataset.piece = type; else delete cell.dataset.piece;
        });
        scoreElement.textContent = game.score.toLocaleString(); linesElement.textContent = game.lines; levelElement.textContent = game.level;
        if (game.score > liveBest) { liveBest = game.score; localStorage.setItem('tetris-best-score', liveBest); }
        bestElement.textContent = liveBest.toLocaleString(); if (game.score > standingBest && !recordBroken) celebrateHighScore();
        boardElement.setAttribute('aria-label', `Tetris board. Score ${game.score}, ${game.lines} lines, level ${game.level}. ${game.paused ? 'Paused.' : game.gameOver ? 'Run complete.' : `${game.piece.type} piece falling.`}`);
        renderMiniatures(); presentLineClear();
    }
    function finish() {
        if (submitted) return; submitted = true;
        const elapsed = seconds(), previous = Number(localStorage.getItem('tetris-best-score')) || 0;
        if (game.score > previous) localStorage.setItem('tetris-best-score', game.score);
        bestElement.textContent = Math.max(previous, game.score).toLocaleString();
        document.querySelector('#finish-summary').textContent = `${game.score.toLocaleString()} points · ${game.lines} lines · level ${game.level} · ${formatTime(elapsed)}`;
        finishElement.hidden = false; statusElement.textContent = 'The stack reached the top. Run complete.'; document.querySelector('#play-again').focus();
        window.Arcade?.record({ game: 'tetris', won: false, details: game.details(elapsed) }).catch(() => {});
    }
    function startGame() {
        game.reset(); activeMilliseconds = 0; submitted = false; miniatureSignature = ''; presentedClearId = 0; standingBest = Number(localStorage.getItem('tetris-best-score')) || 0; liveBest = standingBest; recordBroken = false; clearTimeout(clearEffectTimer); clearTimeout(recordTimer); stageElement.classList.remove('is-clearing','is-new-record'); clearEffectElement.classList.remove('is-active'); recordCalloutElement.classList.remove('is-active'); document.querySelector('.best-stat').classList.remove('is-record');
        finishElement.hidden = true; pauseButton.textContent = 'Pause'; statusElement.textContent = 'Use the controls to place the falling piece.'; lastFrame = performance.now(); render(); boardElement.focus?.();
    }
    function act(action) {
        if (game.gameOver) return;
        const actions = { left:()=>game.move(-1), right:()=>game.move(1), 'rotate-left':()=>game.rotate(-1), 'rotate-right':()=>game.rotate(1), soft:()=>game.softDrop(), hard:()=>game.hardDrop(), hold:()=>game.hold() };
        if (actions[action]?.()) { statusElement.textContent = action === 'hold' ? 'Piece held.' : action === 'hard' ? 'Piece dropped.' : 'Piece moved.'; render(); }
        if (game.gameOver) finish();
    }
    function togglePause(force) {
        if (game.gameOver) return;
        game.paused = force === undefined ? !game.paused : Boolean(force); pauseButton.textContent = game.paused ? 'Resume' : 'Pause'; statusElement.textContent = game.paused ? 'Game paused.' : 'Game resumed.'; lastFrame = performance.now(); render();
    }
    async function shareResult() {
        shareButton.disabled = true;
        try {
            const elapsed = seconds(), image = window.ResultShare.tetris({ board: game.visibleBoard(), colors: themeColors, score: game.score, lines: game.lines, level: game.level, time: formatTime(elapsed) });
            const result = await window.ResultShare.share({ image, filename: 'js-arcade-tetris.png', title: 'My Tetris result', text: `I scored ${game.score.toLocaleString()} points and cleared ${game.lines} lines in JS Arcade Tetris!` });
            if (result === 'downloaded-copy') shareButton.textContent = 'Image saved · caption copied'; else if (result === 'downloaded') shareButton.textContent = 'Image saved';
        } catch (error) { if (error.name !== 'AbortError') shareButton.textContent = 'Could not share'; }
        finally { shareButton.disabled = false; setTimeout(() => { shareButton.textContent = 'Share result'; }, 2600); }
    }
    document.addEventListener('keydown', event => {
        const interactive = event.target.closest?.('button,a,input,select,textarea,dialog,[contenteditable="true"],[role="button"],[role="radio"]');
        if (event.defaultPrevented || interactive || document.querySelector('dialog[open]')) return;
        const keyActions = { ArrowLeft:'left', ArrowRight:'right', ArrowDown:'soft', ArrowUp:'rotate-right', KeyX:'rotate-right', KeyZ:'rotate-left', Space:'hard', KeyC:'hold', ShiftLeft:'hold', ShiftRight:'hold' };
        if (keyActions[event.code]) { event.preventDefault(); act(keyActions[event.code]); }
        else if (['KeyP','Escape'].includes(event.code)) { event.preventDefault(); togglePause(); }
    });
    document.querySelector('.touch-controls').addEventListener('click', event => { const action = event.target.closest('[data-action]')?.dataset.action; if (action) act(action); });
    ['#new-game','#new-game-top','#play-again'].forEach(selector => document.querySelector(selector).addEventListener('click', startGame));
    pauseButton.addEventListener('click', () => togglePause()); shareButton.addEventListener('click', shareResult);
    document.addEventListener('visibilitychange', () => { if (document.hidden && !game.gameOver && !game.paused) togglePause(true); });
    document.addEventListener('arcade:theme', updateTetrisTheme);
    function frame(now) {
        const elapsed = Math.max(0, now - lastFrame); lastFrame = now;
        if (!game.paused && !game.gameOver) {
            activeMilliseconds += elapsed;
            let remaining = elapsed;
            while (remaining > 0 && !game.gameOver) { const step = Math.min(100, remaining); game.update(step); remaining -= step; }
            render(); if (game.gameOver) finish();
        }
        requestAnimationFrame(frame);
    }
    bestElement.textContent = standingBest.toLocaleString(); updateTetrisTheme(); render(); requestAnimationFrame(frame);
})();
