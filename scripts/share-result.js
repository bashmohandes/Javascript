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
    const toBlob = element => new Promise((resolve, reject) => element.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create image.')), 'image/png'));
    async function share({ image, filename, title, text, url = location.href }) {
        const blob = await toBlob(image), file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ title, text, url, files: [file] }); return 'shared'; }
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        try { await navigator.clipboard.writeText(`${text}\n${url}`); return 'downloaded-copy'; } catch { return 'downloaded'; }
    }
    window.ResultShare = { sudoku, pong, minesweeper, share };
})();
