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
        notesMode = false;
        notesButton.setAttribute('aria-pressed', 'false');
        notesButton.querySelector('small').textContent = 'Off';
        mistakesElement.textContent = '0';
        difficultyLabel.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);
        document.querySelector('#hint').innerHTML = '<span aria-hidden="true">◇</span>Hint <small>3 left</small>';
        statusElement.textContent = 'Select an empty square to begin.';
        modal.hidden = true;
        clearInterval(timerId);
        clearInterval(solveTimerId);
        autoSolveButton.disabled = false;
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
                else if (selected.row === rowIndex || selected.column === columnIndex || sameBox(selected.row, selected.column, rowIndex, columnIndex)) cell.classList.add('related');
                if (value && value === selectedValue) cell.classList.add('same');
            }
            if (solvingCell?.row === rowIndex && solvingCell?.column === columnIndex) cell.classList.add('solving');
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
        if (solution[row][column] !== number) {
            mistakes += 1;
            mistakesElement.textContent = mistakes;
            statusElement.textContent = mistakes >= 3 ? 'Three mistakes — start a fresh puzzle when you’re ready.' : 'Not quite. Check the row, column and box.';
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
        if (values.every((boardRow, rowIndex) => boardRow.every((value, columnIndex) => value === solution[rowIndex][columnIndex]))) endGame(true);
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
        document.querySelector('#hint').innerHTML = `<span aria-hidden="true">◇</span>Hint <small>${hints} left</small>`;
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
        if (!won) return;
        document.querySelector('#finish-summary').textContent = `You solved this ${difficultySelect.value} puzzle in ${timerElement.textContent} with ${mistakes} mistake${mistakes === 1 ? '' : 's'}.`;
        modal.hidden = false;
        document.querySelector('#play-again').focus();
    }

    function autoSolve() {
        if (gameOver || autoSolving) return;
        autoSolving = true;
        selected = null;
        autoSolveButton.disabled = true;
        clearInterval(timerId);

        const remaining = [];
        values.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
            if (value !== solution[rowIndex][columnIndex]) remaining.push({ row: rowIndex, column: columnIndex });
        }));

        statusElement.textContent = 'Solving the puzzle… watch the pattern unfold.';
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        solveTimerId = setInterval(() => {
            const nextCell = remaining.shift();
            if (!nextCell) {
                clearInterval(solveTimerId);
                solvingCell = null;
                autoSolving = false;
                gameOver = true;
                statusElement.textContent = 'Puzzle solved automatically.';
                render();
                return;
            }
            values[nextCell.row][nextCell.column] = solution[nextCell.row][nextCell.column];
            notes[nextCell.row][nextCell.column].clear();
            solvingCell = nextCell;
            statusElement.textContent = `${remaining.length} square${remaining.length === 1 ? '' : 's'} left to solve…`;
            render();
        }, reduceMotion ? 1 : 55);
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
    autoSolveButton.addEventListener('click', autoSolve);
    notesButton.addEventListener('click', () => {
        if (gameOver || autoSolving) return;
        notesMode = !notesMode;
        notesButton.setAttribute('aria-pressed', notesMode);
        notesButton.querySelector('small').textContent = notesMode ? 'On' : 'Off';
    });
    ['#new-game', '#new-game-top', '#play-again'].forEach(selector => document.querySelector(selector).addEventListener('click', startGame));
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
