(() => {
    'use strict';
    const W = 1200, H = 630;
    const color = { paper: '#f5f1e8', ink: '#20352f', muted: '#65746f', accent: '#d76b45', line: '#d8d1c5', white: '#fffdf8' };
    const makeCanvas = () => Object.assign(document.createElement('canvas'), { width: W, height: H });
    function label(ctx, value, x, y, size, weight = 500, fill = color.ink, align = 'left') {
        ctx.fillStyle = fill; ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
        ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(value, x, y);
    }
    function frame(ctx, game, headline, summary) {
        ctx.fillStyle = color.paper; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = color.accent; ctx.fillRect(0, 0, 18, H);
        label(ctx, 'JS ARCADE', 70, 80, 24, 800, color.accent);
        label(ctx, game, 70, 145, 54, 800); label(ctx, headline, 70, 205, 28, 650);
        label(ctx, summary, 70, 250, 22, 500, color.muted);
        label(ctx, location.host || 'JS Arcade', 70, 580, 19, 600, color.muted);
    }
    function sudoku({ values, difficulty, time, mistakes }) {
        const result = makeCanvas(), ctx = result.getContext('2d');
        frame(ctx, 'Sudoku', 'Puzzle complete', `${difficulty} · ${time} · ${mistakes} mistake${mistakes === 1 ? '' : 's'}`);
        const size = 405, cell = size / 9, left = 715, top = 110;
        ctx.fillStyle = color.white; ctx.fillRect(left, top, size, size); ctx.strokeStyle = color.line;
        for (let index = 0; index <= 9; index += 1) {
            ctx.lineWidth = index % 3 === 0 ? 5 : 1.5;
            ctx.beginPath(); ctx.moveTo(left + index * cell, top); ctx.lineTo(left + index * cell, top + size); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(left, top + index * cell); ctx.lineTo(left + size, top + index * cell); ctx.stroke();
        }
        values.forEach((row, r) => row.forEach((value, c) => label(ctx, String(value), left + (c + .5) * cell, top + (r + .7) * cell, 27, 700, color.ink, 'center')));
        return result;
    }
    function pong({ board, score, player, opponent, result: outcome, mode, time }) {
        const card = makeCanvas(), ctx = card.getContext('2d');
        const matchup = mode === 'online' ? `${player} vs ${opponent}` : mode === 'duo' ? 'Left vs Right' : 'Player vs Computer';
        frame(ctx, 'Pong', outcome, `Final score ${score[0]}–${score[1]} · ${time}`);
        label(ctx, matchup, 70, 300, 16, 650, color.muted);
        ctx.fillStyle = color.ink; ctx.fillRect(545, 80, 595, 372);
        if (board) ctx.drawImage(board, 545, 80, 595, 372);
        label(ctx, String(score[0]), 807, 535, 52, 800, color.ink, 'right');
        label(ctx, '—', 842, 535, 38, 500, color.muted, 'center');
        label(ctx, String(score[1]), 877, 535, 52, 800, color.ink, 'left');
        return card;
    }
    function minesweeper({ cells, rows, columns, difficulty, time, won }) {
        const card = makeCanvas(), ctx = card.getContext('2d');
        frame(ctx, 'Minesweeper', won ? 'Field cleared!' : 'Mine found', `${difficulty} · ${time}`);
        const maxWidth = 600, maxHeight = 400;
        const cellSize = Math.min(maxWidth / columns, maxHeight / rows);
        const width = cellSize * columns, height = cellSize * rows;
        const left = 555 + (600 - width) / 2, top = 90 + (400 - height) / 2;
        const numberColors = ['#20352f', '#3975a6', '#448054', '#c14d3e', '#65518f', '#963e37', '#277f81', '#3d4541', '#3d4541'];
        cells.forEach((cell, index) => {
            const x = left + (index % columns) * cellSize, y = top + Math.floor(index / columns) * cellSize;
            ctx.fillStyle = cell.revealed ? (cell.mine ? '#b83d39' : '#fffaf0') : cell.flagged ? '#f5d9cb' : '#a9c9b5';
            ctx.fillRect(x + 1, y + 1, Math.max(1, cellSize - 2), Math.max(1, cellSize - 2));
            if (cell.revealed && cell.mine) {
                ctx.fillStyle = color.white; ctx.beginPath(); ctx.arc(x + cellSize / 2, y + cellSize / 2, Math.max(2, cellSize * .2), 0, Math.PI * 2); ctx.fill();
            } else if (cell.flagged) {
                ctx.fillStyle = color.accent; ctx.fillRect(x + cellSize * .3, y + cellSize * .22, Math.max(2, cellSize * .1), cellSize * .58);
                ctx.beginPath(); ctx.moveTo(x + cellSize * .38, y + cellSize * .22); ctx.lineTo(x + cellSize * .75, y + cellSize * .38); ctx.lineTo(x + cellSize * .38, y + cellSize * .52); ctx.fill();
            } else if (cell.revealed && cell.count) {
                label(ctx, String(cell.count), x + cellSize / 2, y + cellSize * .72, Math.max(8, cellSize * .58), 800, numberColors[cell.count], 'center');
            }
        });
        label(ctx, `${rows} × ${columns} field`, 855, 545, 19, 650, color.muted, 'center');
        return card;
    }
    function tictactoe({ board, colors, moves, outcome }) {
        const card = makeCanvas(), ctx = card.getContext('2d');
        frame(ctx, 'Tic-tac-toe', outcome, `${moves} moves · Three in a row`);
        const size = 390, cell = size / 3, left = 690, top = 100;
        ctx.fillStyle = color.ink; ctx.fillRect(left, top, size, size); ctx.strokeStyle = color.muted; ctx.lineWidth = 7;
        for (let i = 1; i < 3; i += 1) { ctx.beginPath(); ctx.moveTo(left + i * cell, top); ctx.lineTo(left + i * cell, top + size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(left, top + i * cell); ctx.lineTo(left + size, top + i * cell); ctx.stroke(); }
        board.forEach((mark, index) => { if (mark) label(ctx, mark, left + (index % 3 + .5) * cell, top + (Math.floor(index / 3) + .72) * cell, 86, 800, colors[mark === 'O' ? 1 : 0], 'center'); });
        return card;
    }
    function tetris({ board, colors, score, lines, level, time }) {
        const card = makeCanvas(), ctx = card.getContext('2d');
        frame(ctx, 'Tetris', `${Number(score).toLocaleString()} points`, `${lines} lines · Level ${level} · ${time}`);
        const cell = 23, left = 790, top = 70, width = cell * 10, height = cell * 20;
        ctx.fillStyle = colors.board || color.ink; ctx.fillRect(left, top, width, height);
        board.forEach((row, y) => row.forEach((piece, x) => {
            ctx.fillStyle = piece ? (colors[piece.toLowerCase()] || color.accent) : (colors.empty || colors.board || color.ink);
            ctx.fillRect(left + x * cell + 1, top + y * cell + 1, cell - 2, cell - 2);
            if (piece) { ctx.strokeStyle = colors['piece-edge'] || color.ink; ctx.strokeRect(left + x * cell + 1.5, top + y * cell + 1.5, cell - 3, cell - 3); }
        }));
        ctx.strokeStyle = colors.border || color.ink; ctx.lineWidth = 5; ctx.strokeRect(left - 2, top - 2, width + 4, height + 4);
        return card;
    }
    function achievement({ icon, title, condition, game }) {
        const card = makeCanvas(), ctx = card.getContext('2d');
        frame(ctx, 'Achievement unlocked', title, game ? `Earned in ${game}` : 'JavaScript Arcade');
        ctx.fillStyle = color.white; ctx.strokeStyle = color.line; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(695, 95, 360, 360, 42); ctx.fill(); ctx.stroke();
        label(ctx, icon, 875, 315, 150, 700, color.ink, 'center');
        ctx.fillStyle = color.accent; ctx.fillRect(70, 318, 72, 7);
        const words = condition.split(/\s+/); let line = '', y = 380;
        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            ctx.font = '600 25px system-ui, -apple-system, "Segoe UI", sans-serif';
            if (line && ctx.measureText(candidate).width > 520) { label(ctx, line, 70, y, 25, 600); line = word; y += 38; }
            else line = candidate;
        }
        if (line) label(ctx, line, 70, y, 25, 600);
        return card;
    }
    const toBlob = (element, type = 'image/png', quality) => new Promise((resolve, reject) => element.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create image.')), type, quality));
    function preview({ blob, title, text, url }, onConfirm) {
        // Web Share requires transient user activation. Run the share callback
        // directly from this dialog's click handler rather than after its close
        // event, which is too late in Safari and other strict implementations.
        if (typeof HTMLDialogElement === 'undefined') return onConfirm();
        const objectUrl = URL.createObjectURL(blob);
        const dialog = document.createElement('dialog');
        dialog.className = 'arcade-dialog result-share-dialog';
        dialog.setAttribute('aria-labelledby', 'result-share-title');
        dialog.innerHTML = `
            <div class="result-share-content">
                <div class="result-share-heading">
                    <div>
                        <p class="result-share-eyebrow">Ready to share</p>
                        <h2 id="result-share-title"></h2>
                    </div>
                    <button class="result-share-close" type="button" aria-label="Close preview">×</button>
                </div>
                <div class="result-share-image-wrap"><img alt="Preview of the generated result image"></div>
                <p class="result-share-caption"></p>
                <p class="result-share-link"></p>
                <div class="result-share-actions">
                    <button class="result-share-cancel" type="button">Cancel</button>
                    <button class="result-share-confirm" type="button">Share photo</button>
                </div>
            </div>`;
        dialog.querySelector('h2').textContent = title;
        dialog.querySelector('img').src = objectUrl;
        dialog.querySelector('.result-share-caption').textContent = text;
        dialog.querySelector('.result-share-link').textContent = new URL(url, location.href).host;
        document.body.append(dialog);
        return new Promise((resolve, reject) => {
            let result;
            let error;
            let confirmed = false;
            const finish = () => dialog.close();
            const confirmButton = dialog.querySelector('.result-share-confirm');
            confirmButton.addEventListener('click', async () => {
                confirmed = true;
                confirmButton.disabled = true;
                try { result = await onConfirm(); }
                catch (shareError) { error = shareError; }
                // Keep the modal preview in place behind the native share sheet.
                // Closing it as iPadOS opens the sheet can turn the same tap into
                // a backdrop click and dismiss both layers. The user can close the
                // preview after returning from a successful native share instead.
                if (result === 'shared') { confirmButton.disabled = false; return; }
                finish();
            });
            dialog.querySelector('.result-share-cancel').addEventListener('click', finish);
            dialog.querySelector('.result-share-close').addEventListener('click', finish);
            dialog.addEventListener('close', () => {
                URL.revokeObjectURL(objectUrl); dialog.remove();
                if (error) reject(error);
                else if (confirmed) resolve(result);
                else reject(new DOMException('Share cancelled', 'AbortError'));
            }, { once: true });
            dialog.showModal();
        });
    }
    async function share({ image, filename, title, text, url = location.href }) {
        const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent)
            || (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1);
        // Safari's share sheet does not reliably create thumbnails for PNG files
        // generated from a canvas. These cards are opaque, so JPEG is a safe and
        // substantially more reliable share-sheet attachment on iOS/iPadOS.
        const type = appleMobile ? 'image/jpeg' : 'image/png';
        const sharedFilename = appleMobile ? filename.replace(/\.png$/i, '.jpg') : filename;
        const blob = await toBlob(image, type, appleMobile ? .92 : undefined);
        const file = new File([blob], sharedFilename, { type });
        const photo = { files: [file] };
        // Passing `url` separately makes Apple devices present a second link item.
        // Keep it in the caption so Messages receives the image and the complete
        // message while the share sheet can still preview the JPEG attachment.
        const shareData = appleMobile ? { ...photo, text: `${text}\n${url}` } : { title, text, url, ...photo };
        return preview({ blob, title, text, url }, async () => {
            if (navigator.share && navigator.canShare?.(shareData)) { await navigator.share(shareData); return 'shared'; }
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = sharedFilename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            try { await navigator.clipboard.writeText(`${text}\n${url}`); return 'downloaded-copy'; } catch { return 'downloaded'; }
        });
    }
    window.ResultShare = { sudoku, pong, minesweeper, tictactoe, tetris, achievement, share };
})();
