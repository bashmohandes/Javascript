(() => {
    'use strict';
    const game = new window.TetrisGame();
    const events = window.ArcadeEvents;
    const boardElement = document.querySelector('#board'), scoreElement = document.querySelector('#score'), linesElement = document.querySelector('#lines'), levelElement = document.querySelector('#level'), bestElement = document.querySelector('#best');
    const statusElement = document.querySelector('#status'), finishElement = document.querySelector('#finish'), pauseButton = document.querySelector('#pause'), shareButton = document.querySelector('#share-result');
    const stageElement = document.querySelector('.tetris-stage'), clearEffectElement = document.querySelector('#line-clear-effect'), clearStreaksElement = document.querySelector('#clear-streaks'), clearBurstElement = document.querySelector('#clear-burst'), clearMultiplierElement = document.querySelector('#clear-multiplier'), recordCalloutElement = document.querySelector('#record-callout');
    const destructionElement = document.querySelector('#magic-destruction'), compactionElement = document.querySelector('#compaction-effect'), powerUpBannerElement = document.querySelector('#power-up-banner'), powerUpIconElement = document.querySelector('#power-up-icon'), powerUpTitleElement = document.querySelector('#power-up-title'), powerUpMessageElement = document.querySelector('#power-up-message'), useShakeButton = document.querySelector('#use-shake');
    const cells = Array.from({ length: 200 }, () => { const cell = document.createElement('span'); cell.className = 'tetris-cell'; boardElement.append(cell); return cell; });
    let activeMilliseconds = 0, lastFrame = performance.now(), submitted = false, themeColors = {}, miniatureSignature = '', presentedClearId = 0, presentedDestructionId = 0, presentedCompactionId = 0, presentedPowerUpId = 0, presentedPieces = game.pieces, presentedProgress = '', clearEffectTimer = 0, destructionTimer = 0, compactionTimer = 0, recordTimer = 0, standingBest = Number(localStorage.getItem('tetris-best-score')) || 0, liveBest = standingBest, recordBroken = false, motionPermission = 'unknown', previousMotion = null, lastShakeAt = 0;
    const tokenNames = ['board','grid','border','empty','ghost','ghost-line','ink','panel','overlay','shadow','piece-edge','magic','i','j','l','o','s','t','z'];
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
    function presentPowerUp() {
        const magic = game.isMagic(), shake = game.shakeReady;
        document.body.classList.toggle('is-magic-power', magic); document.body.classList.toggle('is-shake-ready', shake); stageElement.classList.toggle('is-magic', magic); stageElement.classList.toggle('is-shake-ready', shake);
        if (!magic && !shake) { powerUpBannerElement.hidden = true; return; }
        if (game.lastPowerUp?.id && game.lastPowerUp.id !== presentedPowerUpId) { presentedPowerUpId = game.lastPowerUp.id; events.emit('tetris:power-up-presented', { id: game.lastPowerUp.id, type: magic ? 'magic' : 'shake' }); }
        powerUpBannerElement.hidden = false; powerUpBannerElement.dataset.powerUp = magic ? 'magic' : 'shake'; useShakeButton.hidden = !shake;
        if (magic) {
            powerUpIconElement.textContent = '✦'; powerUpTitleElement.textContent = 'Magic breaker'; powerUpMessageElement.textContent = 'Move through blocks to erase them · Space blasts to the bottom';
        } else {
            const needsPermission = typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function' && motionPermission !== 'granted';
            powerUpIconElement.textContent = '≋'; powerUpTitleElement.textContent = 'Stack shake ready'; powerUpMessageElement.textContent = needsPermission ? 'Enable motion, then shake your device to compact the stack.' : 'Shake your device, press S, or tap to compact the stack.'; useShakeButton.textContent = needsPermission ? 'Enable device shake' : 'Compact now';
        }
    }
    function presentDestruction() {
        const destruction = game.lastDestruction;
        if (!destruction || destruction.id === presentedDestructionId) return;
        presentedDestructionId = destruction.id;
        destructionElement.replaceChildren(...destruction.cells.filter(cell => cell.y >= 0).map((hit, index) => {
            const burst = document.createElement('i'); burst.dataset.piece = hit.type; burst.style.setProperty('--impact-x', hit.x); burst.style.setProperty('--impact-y', hit.y); burst.style.setProperty('--impact-delay', `${index * 24}ms`); return burst;
        }));
        destructionElement.classList.remove('is-active'); void destructionElement.offsetWidth; destructionElement.classList.add('is-active'); stageElement.classList.add('is-magic-impact');
        clearTimeout(destructionTimer); destructionTimer = setTimeout(() => { destructionElement.classList.remove('is-active'); stageElement.classList.remove('is-magic-impact'); }, 700);
        events.emit('tetris:blocks-destroyed', { count: destruction.count, points: destruction.points, damage: Math.min(50, destruction.count * 8) });
        statusElement.textContent = `${destruction.count} block${destruction.count === 1 ? '' : 's'} destroyed · +${destruction.points} points`;
    }
    function presentCompaction() {
        const compaction = game.lastCompaction;
        if (!compaction || compaction.id === presentedCompactionId) return;
        presentedCompactionId = compaction.id;
        compactionElement.replaceChildren(...compaction.moved.map((move, index) => {
            const block = document.createElement('i'); block.dataset.piece = move.type; block.style.setProperty('--fall-x', move.x); block.style.setProperty('--fall-from', move.from); block.style.setProperty('--fall-to', move.to); block.style.setProperty('--fall-delay', `${Math.min(index * 12, 180)}ms`); return block;
        }));
        compactionElement.classList.remove('is-active'); void compactionElement.offsetWidth; compactionElement.classList.add('is-active'); stageElement.classList.add('is-compacting');
        clearTimeout(compactionTimer); compactionTimer = setTimeout(() => { compactionElement.classList.remove('is-active'); stageElement.classList.remove('is-compacting'); }, 900);
        events.emit('tetris:stack-compacted', { count: compaction.count });
        statusElement.textContent = compaction.count ? `${compaction.count} block${compaction.count === 1 ? '' : 's'} fell into place.` : 'The stack is already compact.';
    }
    function presentLineClear() {
        const clear = game.lastClear;
        if (!clear || clear.id === presentedClearId) return;
        presentedClearId = clear.id; stageElement.dataset.clearIntensity = Math.min(4, clear.count); clearMultiplierElement.textContent = `x${clear.count}`;
        clearStreaksElement.replaceChildren(...clear.rows.map((row, index) => {
            const streak = document.createElement('span'); streak.className = 'clear-streak'; streak.style.setProperty('--clear-row', row); streak.style.setProperty('--clear-delay', `${index * 32}ms`); return streak;
        }));
        clearBurstElement.replaceChildren(...Array.from({ length: 24 + clear.count * 8 }, (_, index) => {
            const spark = document.createElement('i'); spark.style.setProperty('--spark-angle', `${index * 137.5}deg`); spark.style.setProperty('--spark-distance', `${75 + index % 7 * 13 + clear.count * 12}px`); spark.style.setProperty('--spark-delay', `${index % 6 * 18}ms`); return spark;
        }));
        stageElement.classList.remove('is-clearing'); clearEffectElement.classList.remove('is-active'); void clearEffectElement.offsetWidth;
        stageElement.classList.add('is-clearing'); clearEffectElement.classList.add('is-active');
        clearTimeout(clearEffectTimer); clearEffectTimer = setTimeout(() => { stageElement.classList.remove('is-clearing'); clearEffectElement.classList.remove('is-active'); }, 1250);
        events.emit('tetris:lines-cleared', { count: clear.count, rows: [...clear.rows] });
        statusElement.textContent = `${clear.count} line${clear.count === 1 ? '' : 's'} cleared · x${clear.count}`;
    }
    function celebrateHighScore() {
        recordBroken = true; stageElement.classList.remove('is-new-record'); recordCalloutElement.classList.remove('is-active'); void recordCalloutElement.offsetWidth;
        stageElement.classList.add('is-new-record'); recordCalloutElement.classList.add('is-active'); document.querySelector('.best-stat').classList.add('is-record');
        statusElement.textContent = `New high score: ${game.score.toLocaleString()}!`;
        events.emit('tetris:local-record-broken', { score: game.score, previous: standingBest });
        clearTimeout(recordTimer); recordTimer = setTimeout(() => { stageElement.classList.remove('is-new-record'); recordCalloutElement.classList.remove('is-active'); }, 2200);
    }
    function render() {
        const board = game.visibleBoard(), active = new Map(game.activeCells().filter(([,y]) => y >= 0).map(([x,y]) => [`${x},${y}`, game.piece.type])), ghost = new Set(game.ghostCells().filter(([,y]) => y >= 0).map(([x,y]) => `${x},${y}`));
        if (game.pieces > presentedPieces) { presentedPieces = game.pieces; events.emit('tetris:piece-locked', { pieces: game.pieces }); }
        const highest = board.findIndex(row => row.some(Boolean)), danger = highest < 0 ? 0 : Math.max(0, Math.min(1, (8 - highest) / 8));
        const progress = `${game.level}:${danger.toFixed(2)}`;
        if (!game.gameOver && progress !== presentedProgress) { presentedProgress = progress; events.emit('game:progressed', { level: game.level, intensity: Math.min(.9, .2 + game.level * .07), danger }); }
        cells.forEach((cell, index) => {
            const x = index % 10, y = Math.floor(index / 10), type = active.get(`${x},${y}`) || board[y][x];
            cell.className = `tetris-cell${!type && ghost.has(`${x},${y}`) ? ' ghost' : ''}`;
            if (type) cell.dataset.piece = type; else delete cell.dataset.piece;
        });
        scoreElement.textContent = game.score.toLocaleString(); linesElement.textContent = game.lines; levelElement.textContent = game.level;
        if (game.score > liveBest) { liveBest = game.score; localStorage.setItem('tetris-best-score', liveBest); }
        bestElement.textContent = liveBest.toLocaleString(); if (game.score > standingBest && !recordBroken) celebrateHighScore();
        boardElement.setAttribute('aria-label', `Tetris board. Score ${game.score}, ${game.lines} lines, level ${game.level}. ${game.paused ? 'Paused.' : game.gameOver ? 'Run complete.' : game.shakeReady ? 'Shake power-up ready.' : game.isMagic() ? 'Magic breaker falling.' : `${game.piece.type} piece falling.`}`);
        renderMiniatures(); presentPowerUp(); presentDestruction(); presentCompaction(); presentLineClear();
    }
    function finish() {
        if (submitted) return; submitted = true;
        const elapsed = seconds(), previous = Number(localStorage.getItem('tetris-best-score')) || 0;
        if (game.score > previous) localStorage.setItem('tetris-best-score', game.score);
        bestElement.textContent = Math.max(previous, game.score).toLocaleString();
        document.querySelector('#finish-summary').textContent = `${game.score.toLocaleString()} points · ${game.lines} lines · level ${game.level} · ${formatTime(elapsed)}`;
        finishElement.hidden = false; statusElement.textContent = 'The stack reached the top. Run complete.'; document.querySelector('#play-again').focus();
        events.emit('game:completed', { outcome: 'loss', score: game.score, lines: game.lines, level: game.level });
        window.Arcade?.record({ game: 'tetris', won: false, details: game.details(elapsed) }).catch(() => {});
    }
    function startGame() {
        game.reset(); activeMilliseconds = 0; submitted = false; miniatureSignature = ''; presentedClearId = 0; presentedDestructionId = 0; presentedCompactionId = 0; presentedPowerUpId = 0; presentedPieces = game.pieces; presentedProgress = ''; previousMotion = null; standingBest = Number(localStorage.getItem('tetris-best-score')) || 0; liveBest = standingBest; recordBroken = false; clearTimeout(clearEffectTimer); clearTimeout(destructionTimer); clearTimeout(compactionTimer); clearTimeout(recordTimer); stageElement.classList.remove('is-clearing','is-new-record','is-magic','is-magic-impact','is-shake-ready','is-compacting'); clearEffectElement.classList.remove('is-active'); destructionElement.classList.remove('is-active'); compactionElement.classList.remove('is-active'); recordCalloutElement.classList.remove('is-active'); document.body.classList.remove('is-magic-power','is-shake-ready'); document.querySelector('.best-stat').classList.remove('is-record'); powerUpBannerElement.hidden = true;
        finishElement.hidden = true; pauseButton.textContent = 'Pause'; statusElement.textContent = 'Use the controls to place the falling piece.'; lastFrame = performance.now(); render(); boardElement.focus?.();
        events.emit('game:started', { intensity: .2, danger: 0, mode: 'marathon' });
    }
    function act(action) {
        if (game.gameOver) return;
        const actions = { left:()=>game.move(-1), right:()=>game.move(1), 'rotate-left':()=>game.rotate(-1), 'rotate-right':()=>game.rotate(1), soft:()=>game.softDrop(), hard:()=>game.hardDrop(), hold:()=>game.hold() };
        if (actions[action]?.()) { events.emit('tetris:piece-manipulated', { action: action === 'hard' ? 'hard-drop' : action }); statusElement.textContent = action === 'hold' ? 'Piece held.' : action === 'hard' ? 'Piece dropped.' : 'Piece moved.'; render(); }
        if (game.gameOver) finish();
    }
    function activateShake() {
        const result = game.useShake(); if (!result) return false;
        events.emit('tetris:power-up-activated', { type: 'shake' });
        previousMotion = null; render(); return true;
    }
    async function enableMotionOrCompact() {
        if (!game.shakeReady) return;
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function' && motionPermission !== 'granted') {
            try { motionPermission = await DeviceMotionEvent.requestPermission(); }
            catch { motionPermission = 'denied'; }
            if (motionPermission === 'granted') { statusElement.textContent = 'Motion enabled. Shake your device, or tap Compact now.'; presentPowerUp(); return; }
        }
        activateShake();
    }
    function handleDeviceMotion(event) {
        if (!game.shakeReady || game.paused) { previousMotion = null; return; }
        const motion = event.accelerationIncludingGravity || event.acceleration; if (!motion) return;
        const current = [motion.x || 0, motion.y || 0, motion.z || 0];
        if (previousMotion) {
            const force = current.reduce((total, value, index) => total + Math.abs(value - previousMotion[index]), 0), now = performance.now();
            if (force > 22 && now - lastShakeAt > 900) { lastShakeAt = now; activateShake(); }
        }
        previousMotion = current;
    }
    function togglePause(force) {
        if (game.gameOver) return;
        game.paused = force === undefined ? !game.paused : Boolean(force); pauseButton.textContent = game.paused ? 'Resume' : 'Pause'; statusElement.textContent = game.paused ? 'Game paused.' : 'Game resumed.'; lastFrame = performance.now(); render();
        events.emit('game:paused', { paused: game.paused });
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
        else if (event.code === 'KeyS' && game.shakeReady) { event.preventDefault(); activateShake(); }
        else if (['KeyP','Escape'].includes(event.code)) { event.preventDefault(); togglePause(); }
    });
    document.querySelector('.touch-controls').addEventListener('click', event => { const action = event.target.closest('[data-action]')?.dataset.action; if (action) act(action); });
    ['#new-game','#new-game-top','#play-again'].forEach(selector => document.querySelector(selector).addEventListener('click', startGame));
    pauseButton.addEventListener('click', () => togglePause()); shareButton.addEventListener('click', shareResult); useShakeButton.addEventListener('click', enableMotionOrCompact); window.addEventListener('devicemotion', handleDeviceMotion);
    document.addEventListener('visibilitychange', () => { if (document.hidden && !game.gameOver && !game.paused) togglePause(true); });
    window.ArcadeEvents.on('system:theme-changed', updateTetrisTheme);
    function frame(now) {
        const elapsed = Math.max(0, now - lastFrame); lastFrame = now;
        if (!game.paused && !game.gameOver && !game.shakeReady) {
            activeMilliseconds += elapsed;
            let remaining = elapsed, changed = false;
            while (remaining > 0 && !game.gameOver) { const step = Math.min(100, remaining); changed = game.update(step) || changed; remaining -= step; }
            if (changed) render(); if (game.gameOver) finish();
        }
        requestAnimationFrame(frame);
    }
    bestElement.textContent = standingBest.toLocaleString(); updateTetrisTheme(); render(); requestAnimationFrame(frame);
})();
