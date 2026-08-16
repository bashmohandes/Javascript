(() => {
    'use strict';

    const EMPTY_CELLS = { easy: 36, medium: 45, hard: 52 };
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

    const shuffle = items => {
        const result = [...items];
        for (let index = result.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
        }
        return result;
    };

    function generateSolution() {
        const pattern = (row, column) => (row * 3 + Math.floor(row / 3) + column) % 9;
        const groups = shuffle([0, 1, 2]);
        const rows = groups.flatMap(group => shuffle([0, 1, 2]).map(row => group * 3 + row));
        const columns = shuffle([0, 1, 2]).flatMap(group => shuffle([0, 1, 2]).map(column => group * 3 + column));
        const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        return rows.map(row => columns.map(column => numbers[pattern(row, column)]));
    }

    function createPuzzle(difficulty) {
        const completed = generateSolution();
        const playable = completed.map(row => [...row]);
        shuffle(Array.from({ length: 81 }, (_, index) => index))
            .slice(0, EMPTY_CELLS[difficulty])
            .forEach(index => { playable[Math.floor(index / 9)][index % 9] = 0; });
        return { completed, playable };
    }

    function startGame() {
        const difficulty = difficultySelect.value;
        const generated = createPuzzle(difficulty);
        solution = generated.completed;
        puzzle = generated.playable;
        values = puzzle.map(row => [...row]);
        notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
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

    const sameBox = (rowA, columnA, rowB, columnB) =>
        Math.floor(rowA / 3) === Math.floor(rowB / 3) && Math.floor(columnA / 3) === Math.floor(columnB / 3);

    function selectCell(row, column) {
        if (gameOver || autoSolving) return;
        selected = { row, column };
        statusElement.textContent = puzzle[row][column] ? 'This number is part of the puzzle.' : 'Choose a number, or switch on notes.';
        render();
    }

    function enterNumber(number) {
        if (!selected || gameOver || autoSolving) return;
        const { row, column } = selected;
        if (puzzle[row][column]) return;
        if (notesMode && !values[row][column]) {
            notes[row][column].has(number) ? notes[row][column].delete(number) : notes[row][column].add(number);
            statusElement.textContent = `Note ${number} ${notes[row][column].has(number) ? 'added' : 'removed'}.`;
            render();
            return;
        }
        if (!isPlacementValid(values, row, column, number)) {
            mistakes += 1;
            mistakesElement.textContent = mistakes;
            statusElement.textContent = mistakes >= 3 ? 'Three mistakes — start a fresh puzzle when you’re ready.' : 'That number already appears in the row, column or box.';
            const cell = boardElement.querySelector(`[data-row="${row}"][data-column="${column}"]`);
            cell.classList.add('error');
            if (mistakes >= 3) endGame(false);
            return;
        }
        values[row][column] = number;
        notes[row][column].clear();
        removePeerNotes(row, column, number);
        statusElement.textContent = 'Nice. Keep going.';
        render();
        if (values.every(boardRow => boardRow.every(Boolean))) endGame(true);
    }

    function removePeerNotes(row, column, number) {
        notes.forEach((noteRow, rowIndex) => noteRow.forEach((cellNotes, columnIndex) => {
            if (rowIndex === row || columnIndex === column || sameBox(row, column, rowIndex, columnIndex)) cellNotes.delete(number);
        }));
    }

    function erase() {
        if (!selected || puzzle[selected.row][selected.column] || gameOver || autoSolving) return;
        values[selected.row][selected.column] = 0;
        notes[selected.row][selected.column].clear();
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
        removePeerNotes(row, column, solution[row][column]);
        hints -= 1;
        document.querySelector('#hint').innerHTML = `${CONTROL_ICONS.hint}Hint <small>${hints} left</small>`;
        statusElement.textContent = 'A little nudge in the right direction.';
        render();
    }

    function updateNumberPad() {
        document.querySelectorAll('.number').forEach(button => {
            const number = Number(button.dataset.number);
            button.disabled = values.flat().filter(value => value === number).length === 9;
        });
    }

    function endGame(won) {
        gameOver = true;
        clearInterval(timerId);
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

        const solverGrid = puzzle.map(row => [...row]);
        const emptyCells = [];
        solverGrid.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
            if (!value) emptyCells.push({ row: rowIndex, column: columnIndex });
        }));
        const nextCandidates = Array(emptyCells.length).fill(1);
        let cellIndex = 0;
        let attempts = 0;
        let backtracks = 0;

        values = solverGrid.map(row => [...row]);
        notes.forEach(row => row.forEach(cellNotes => cellNotes.clear()));

        statusElement.setAttribute('aria-live', 'off');
        statusElement.textContent = 'Searching for a solution with backtracking…';
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        solveTimerId = setInterval(() => {
            if (cellIndex === emptyCells.length) {
                clearInterval(solveTimerId);
                solvingCell = null;
                autoSolving = false;
                gameOver = true;
                solveSnapshot = null;
                updateAutoSolveButton(false);
                autoSolveButton.disabled = true;
                statusElement.setAttribute('aria-live', 'polite');
                statusElement.textContent = `Solved with ${attempts} tries and ${backtracks} backtrack${backtracks === 1 ? '' : 's'}.`;
                render();
                return;
            }

            if (cellIndex < 0) {
                clearInterval(solveTimerId);
                autoSolving = false;
                gameOver = true;
                solveSnapshot = null;
                updateAutoSolveButton(false);
                autoSolveButton.disabled = true;
                statusElement.setAttribute('aria-live', 'polite');
                statusElement.textContent = 'No solution exists for this puzzle.';
                return;
            }

            const cell = emptyCells[cellIndex];
            const candidate = nextCandidates[cellIndex];
            if (candidate > 9) {
                solverGrid[cell.row][cell.column] = 0;
                values[cell.row][cell.column] = 0;
                nextCandidates[cellIndex] = 1;
                cellIndex -= 1;
                backtracks += 1;
                if (cellIndex >= 0) {
                    const previous = emptyCells[cellIndex];
                    solverGrid[previous.row][previous.column] = 0;
                    values[previous.row][previous.column] = 0;
                    solvingCell = { ...previous, state: 'backtrack' };
                    statusElement.textContent = `Dead end at row ${cell.row + 1}, column ${cell.column + 1} — backtracking.`;
                }
                render();
                return;
            }

            attempts += 1;
            nextCandidates[cellIndex] = candidate + 1;
            solverGrid[cell.row][cell.column] = candidate;
            values[cell.row][cell.column] = candidate;
            if (isSolverCandidateValid(solverGrid, cell.row, cell.column)) {
                solvingCell = { ...cell, state: 'accepted' };
                statusElement.textContent = `${candidate} fits at row ${cell.row + 1}, column ${cell.column + 1}.`;
                cellIndex += 1;
            } else {
                solvingCell = { ...cell, state: 'rejected' };
                statusElement.textContent = `Trying ${candidate} at row ${cell.row + 1}, column ${cell.column + 1}…`;
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

    function isSolverCandidateValid(grid, row, column) {
        return isPlacementValid(grid, row, column, grid[row][column]);
    }

    function isPlacementValid(grid, row, column, value) {
        for (let index = 0; index < 9; index++) {
            if (index !== column && grid[row][index] === value) return false;
            if (index !== row && grid[index][column] === value) return false;
        }
        const boxRow = Math.floor(row / 3) * 3;
        const boxColumn = Math.floor(column / 3) * 3;
        for (let rowIndex = boxRow; rowIndex < boxRow + 3; rowIndex++) {
            for (let columnIndex = boxColumn; columnIndex < boxColumn + 3; columnIndex++) {
                if ((rowIndex !== row || columnIndex !== column) && grid[rowIndex][columnIndex] === value) return false;
            }
        }
        return true;
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
