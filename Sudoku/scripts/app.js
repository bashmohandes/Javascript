(() => {
    'use strict';

    const rules = window.SudokuGame;
    if (!rules) throw new Error('Sudoku mechanics failed to load.');
    const { sameBox } = rules;
    const boardElement = document.querySelector('#board');
    const timerElement = document.querySelector('#timer');
    const mistakesElement = document.querySelector('#mistakes');
    const statusElement = document.querySelector('#status');
    const difficultySelect = document.querySelector('#difficulty');
    const difficultyLabel = document.querySelector('#difficulty-label');
    const notesButton = document.querySelector('#notes');
    const autoSolveButton = document.querySelector('#auto-solve');
    const modal = document.querySelector('#finish-modal');
    const shareButton = document.querySelector('#share-result');
    const events = window.ArcadeEvents;
    const CONTROL_ICONS = {
        hint: '<svg class="tool-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M9 18h6M10 22h4"/><path d="M8.2 14.7a7 7 0 1 1 7.6 0c-.5.4-.8 1-.8 1.6V17H9v-.7c0-.6-.3-1.2-.8-1.6Z"/></svg>',
        play: '<svg class="tool-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path class="tool-icon-fill" d="m8 5 11 7-11 7Z"/></svg>',
        stop: '<svg class="tool-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><rect class="tool-icon-fill" x="6" y="6" width="12" height="12" rx="1"/></svg>'
    };

    let solution = [];
    let puzzle = [];
    let values = [];
    let notes = [];
    let selected = null;
    let mistakes = 0;
    let hints = 3;
    let notesMode = false;
    let elapsed = 0;
    let timerId;
    let solveTimerId;
    let gameOver = false;
    let autoSolving = false;
    let solvingCell = null;
    let solveSnapshot = null;

    function startGame() {
        const difficulty = difficultySelect.value;
        const generated = rules.createPuzzle(difficulty);
        solution = generated.completed;
        puzzle = generated.playable;
        values = puzzle.map(row => [...row]);
        notes = rules.createNotes();
        selected = null;
        mistakes = 0;
        hints = 3;
        elapsed = 0;
        gameOver = false;
        autoSolving = false;
        solvingCell = null;
        solveSnapshot = null;
        notesMode = false;
        notesButton.setAttribute('aria-pressed', 'false');
        notesButton.querySelector('small').textContent = 'Off';
        mistakesElement.textContent = '0';
        difficultyLabel.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);
        document.querySelector('#hint').innerHTML = `${CONTROL_ICONS.hint}Hint <small>3 left</small>`;
        statusElement.setAttribute('aria-live', 'polite');
        statusElement.textContent = 'Select an empty square to begin.';
        modal.hidden = true;
        clearInterval(timerId);
        clearInterval(solveTimerId);
        autoSolveButton.disabled = false;
        updateAutoSolveButton(false);
        timerId = setInterval(() => { elapsed += 1; renderTimer(); }, 1000);
        renderTimer();
        render();
        events.emit('game:started', { intensity: 0, danger: 0, difficulty });
    }

    function renderTimer() {
        const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const seconds = String(elapsed % 60).padStart(2, '0');
        timerElement.textContent = `${minutes}:${seconds}`;
    }

    function render() {
        boardElement.replaceChildren();
        const selectedValue = selected ? values[selected.row][selected.column] : 0;
        values.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
            const cell = document.createElement('button');
            const isGiven = puzzle[rowIndex][columnIndex] !== 0;
            cell.type = 'button';
            cell.className = 'cell';
            cell.setAttribute('role', 'gridcell');
            cell.setAttribute('aria-rowindex', rowIndex + 1);
            cell.setAttribute('aria-colindex', columnIndex + 1);
            cell.dataset.row = rowIndex;
            cell.dataset.column = columnIndex;
            if (isGiven) cell.classList.add('given');
            if (selected) {
                if (selected.row === rowIndex && selected.column === columnIndex) cell.classList.add('selected');
                else if (sameBox(selected.row, selected.column, rowIndex, columnIndex)) cell.classList.add('same-box');
                else if (selected.row === rowIndex || selected.column === columnIndex) cell.classList.add('related');
                if (value && value === selectedValue) cell.classList.add('same');
            }
            if (solvingCell?.row === rowIndex && solvingCell?.column === columnIndex) {
                cell.classList.add('solving', `solving-${solvingCell.state}`);
            }
            if (value) {
                cell.textContent = value;
                cell.setAttribute('aria-label', `Row ${rowIndex + 1}, column ${columnIndex + 1}, ${value}${isGiven ? ', given' : ''}`);
            } else {
                const noteGrid = document.createElement('span');
                noteGrid.className = 'notes-grid';
                for (let number = 1; number <= 9; number++) {
                    const note = document.createElement('span');
                    note.textContent = notes[rowIndex][columnIndex].has(number) ? number : '';
                    noteGrid.append(note);
                }
                cell.append(noteGrid);
                cell.setAttribute('aria-label', `Row ${rowIndex + 1}, column ${columnIndex + 1}, empty`);
            }
            cell.addEventListener('click', () => selectCell(rowIndex, columnIndex));
            boardElement.append(cell);
        }));
        updateNumberPad();
    }

    function selectCell(row, column) {
        if (gameOver || autoSolving) return;
        selected = { row, column };
        events.emit('sudoku:cell-selected', { row, column, given: Boolean(puzzle[row][column]) });
        statusElement.textContent = puzzle[row][column] ? 'This number is part of the puzzle.' : 'Choose a number, or switch on notes.';
        render();
    }

    function enterNumber(number) {
        if (!selected || gameOver || autoSolving) return;
        const { row, column } = selected;
        if (puzzle[row][column]) return;
        if (notesMode && !values[row][column]) {
            notes[row][column].has(number) ? notes[row][column].delete(number) : notes[row][column].add(number);
            events.emit('sudoku:note-entered', { row, column, number, present: notes[row][column].has(number) });
            statusElement.textContent = `Note ${number} ${notes[row][column].has(number) ? 'added' : 'removed'}.`;
            render();
            return;
        }
        if (!rules.isPlacementValid(values, row, column, number)) {
            mistakes += 1;
            mistakesElement.textContent = mistakes;
            statusElement.textContent = mistakes >= 3 ? 'Three mistakes — start a fresh puzzle when you’re ready.' : 'That number already appears in the row, column or box.';
            const cell = boardElement.querySelector(`[data-row="${row}"][data-column="${column}"]`);
            cell.classList.add('error');
            events.emit('sudoku:entry-rejected', { row, column, number, mistakes });
            if (mistakes >= 3) endGame(false);
            return;
        }
        values[row][column] = number;
        events.emit('sudoku:entry-accepted', { row, column, number });
        notes[row][column].clear();
        rules.removePeerNotes(notes, row, column, number);
        statusElement.textContent = 'Nice. Keep going.';
        render();
        publishProgress();
        if (values.every(boardRow => boardRow.every(Boolean))) endGame(true);
    }

    function erase() {
        if (!selected || puzzle[selected.row][selected.column] || gameOver || autoSolving) return;
        values[selected.row][selected.column] = 0;
        notes[selected.row][selected.column].clear();
        events.emit('sudoku:cell-erased', { row: selected.row, column: selected.column });
        statusElement.textContent = 'Square cleared.';
        render();
    }

    function giveHint() {
        if (!selected || puzzle[selected.row][selected.column] || gameOver || autoSolving) {
            statusElement.textContent = 'Select an empty square to use a hint.';
            return;
        }
        if (!hints) { statusElement.textContent = 'You’ve used all three hints.'; return; }
        const { row, column } = selected;
        values[row][column] = solution[row][column];
        notes[row][column].clear();
        rules.removePeerNotes(notes, row, column, solution[row][column]);
        hints -= 1;
        events.emit('sudoku:hint-used', { row, column, number: solution[row][column], remaining: hints });
        document.querySelector('#hint').innerHTML = `${CONTROL_ICONS.hint}Hint <small>${hints} left</small>`;
        statusElement.textContent = 'A little nudge in the right direction.';
        render();
        publishProgress();
    }

    function updateNumberPad() {
        document.querySelectorAll('.number').forEach(button => {
            const number = Number(button.dataset.number);
            button.disabled = values.flat().filter(value => value === number).length === 9;
        });
    }

    function publishProgress() {
        const open = puzzle.flat().filter(value => !value).length || 1;
        const filled = values.flat().filter(Boolean).length - puzzle.flat().filter(Boolean).length;
        const progress = Math.max(0, Math.min(1, filled / open));
        events.emit('game:progressed', { progress, intensity: .12 + progress * .55, danger: mistakes / 3 });
    }

    function endGame(won) {
        gameOver = true;
        clearInterval(timerId);
        events.emit('game:completed', { outcome: won ? 'win' : 'loss', seconds: elapsed, mistakes, hintsUsed: 3 - hints });
        const difficulty = difficultySelect.value;
        window.Arcade?.record({ game: 'sudoku', won, details: { difficulty, seconds: elapsed, mistakes, hintsUsed: 3 - hints } }).catch(() => {});
        if (!won) return;
        document.querySelector('#finish-summary').textContent = `You solved this ${difficultySelect.value} puzzle in ${timerElement.textContent} with ${mistakes} mistake${mistakes === 1 ? '' : 's'}.`;
        modal.hidden = false;
        document.querySelector('#play-again').focus();
    }

    async function shareResult() {
        const difficulty = difficultySelect.value;
        const caption = `I solved a ${difficulty} Sudoku in ${timerElement.textContent} with ${mistakes} mistake${mistakes === 1 ? '' : 's'}!`;
        shareButton.disabled = true;
        try {
            const image = window.ResultShare.sudoku({ values, difficulty: difficultyLabel.textContent, time: timerElement.textContent, mistakes });
            const result = await window.ResultShare.share({ image, filename: 'js-arcade-sudoku.png', title: 'My Sudoku result', text: caption });
            if (result === 'downloaded-copy') shareButton.textContent = 'Image saved · caption copied';
            else if (result === 'downloaded') shareButton.textContent = 'Image saved';
        } catch (error) { if (error.name !== 'AbortError') shareButton.textContent = 'Could not share'; }
        finally { shareButton.disabled = false; setTimeout(() => { shareButton.textContent = 'Share result'; }, 2600); }
    }

    function autoSolve() {
        if (gameOver || autoSolving) return;
        solveSnapshot = {
            values: values.map(row => [...row]),
            notes: notes.map(row => row.map(cellNotes => new Set(cellNotes))),
            selected: selected ? { ...selected } : null
        };
        autoSolving = true;
        selected = null;
        updateAutoSolveButton(true);
        clearInterval(timerId);

        const solver = rules.createSolver(puzzle);
        values = solver.grid;
        notes.forEach(row => row.forEach(cellNotes => cellNotes.clear()));

        statusElement.setAttribute('aria-live', 'off');
        statusElement.textContent = 'Searching for a solution with backtracking…';
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        solveTimerId = setInterval(() => {
            const result = rules.stepSolver(solver);
            if (result.type === 'complete') {
                clearInterval(solveTimerId);
                solvingCell = null;
                autoSolving = false;
                gameOver = true;
                solveSnapshot = null;
                updateAutoSolveButton(false);
                autoSolveButton.disabled = true;
                statusElement.setAttribute('aria-live', 'polite');
                statusElement.textContent = `Solved with ${solver.attempts} tries and ${solver.backtracks} backtrack${solver.backtracks === 1 ? '' : 's'}.`;
                events.emit('game:stopped', { reason: 'auto-solved' });
                render();
                return;
            }

            if (result.type === 'unsolvable') {
                clearInterval(solveTimerId);
                autoSolving = false;
                gameOver = true;
                solveSnapshot = null;
                updateAutoSolveButton(false);
                autoSolveButton.disabled = true;
                statusElement.setAttribute('aria-live', 'polite');
                statusElement.textContent = 'No solution exists for this puzzle.';
                events.emit('game:stopped', { reason: 'unsolvable' });
                return;
            }

            if (result.type === 'backtrack') {
                solvingCell = result.previous ? { ...result.previous, state: 'backtrack' } : null;
                statusElement.textContent = `Dead end at row ${result.cell.row + 1}, column ${result.cell.column + 1} — backtracking.`;
                render();
                return;
            }

            solvingCell = { ...result.cell, state: result.type };
            if (result.type === 'accepted') {
                statusElement.textContent = `${result.candidate} fits at row ${result.cell.row + 1}, column ${result.cell.column + 1}.`;
            } else {
                statusElement.textContent = `Trying ${result.candidate} at row ${result.cell.row + 1}, column ${result.cell.column + 1}…`;
            }
            render();
        }, reduceMotion ? 1 : 45);
    }

    function stopAutoSolve() {
        if (!autoSolving || !solveSnapshot) return;
        clearInterval(solveTimerId);
        values = solveSnapshot.values;
        notes = solveSnapshot.notes;
        selected = solveSnapshot.selected;
        solveSnapshot = null;
        solvingCell = null;
        autoSolving = false;
        updateAutoSolveButton(false);
        statusElement.setAttribute('aria-live', 'polite');
        statusElement.textContent = 'Auto solve stopped. Your board has been restored.';
        timerId = setInterval(() => { elapsed += 1; renderTimer(); }, 1000);
        render();
    }

    function updateAutoSolveButton(isSolving) {
        autoSolveButton.setAttribute('aria-pressed', String(isSolving));
        autoSolveButton.innerHTML = isSolving
            ? `${CONTROL_ICONS.stop}Stop solve`
            : `${CONTROL_ICONS.play}Auto solve`;
        autoSolveButton.classList.toggle('is-stopping', isSolving);
    }

    function moveSelection(rowChange, columnChange) {
        if (gameOver || autoSolving) return;
        if (!selected) selected = { row: 0, column: 0 };
        else selected = { row: Math.max(0, Math.min(8, selected.row + rowChange)), column: Math.max(0, Math.min(8, selected.column + columnChange)) };
        render();
        boardElement.querySelector(`[data-row="${selected.row}"][data-column="${selected.column}"]`).focus();
    }

    const numberPad = document.querySelector('#number-pad');
    for (let number = 1; number <= 9; number++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'number';
        button.dataset.number = number;
        button.textContent = number;
        button.setAttribute('aria-label', `Enter ${number}`);
        button.addEventListener('click', () => enterNumber(number));
        numberPad.append(button);
    }

    document.querySelector('#erase').addEventListener('click', erase);
    document.querySelector('#hint').addEventListener('click', giveHint);
    autoSolveButton.addEventListener('click', () => autoSolving ? stopAutoSolve() : autoSolve());
    notesButton.addEventListener('click', () => {
        if (gameOver || autoSolving) return;
        notesMode = !notesMode;
        notesButton.setAttribute('aria-pressed', notesMode);
        notesButton.querySelector('small').textContent = notesMode ? 'On' : 'Off';
    });
    ['#new-game', '#new-game-top', '#play-again'].forEach(selector => document.querySelector(selector).addEventListener('click', startGame));
    shareButton.addEventListener('click', shareResult);
    difficultySelect.addEventListener('change', startGame);
    document.addEventListener('keydown', event => {
        if (/^[1-9]$/.test(event.key)) enterNumber(Number(event.key));
        else if (event.key === 'Backspace' || event.key === 'Delete') erase();
        else if (event.key.toLowerCase() === 'n') notesButton.click();
        else if (event.key === 'ArrowUp') moveSelection(-1, 0);
        else if (event.key === 'ArrowDown') moveSelection(1, 0);
        else if (event.key === 'ArrowLeft') moveSelection(0, -1);
        else if (event.key === 'ArrowRight') moveSelection(0, 1);
    });

    startGame();
})();
