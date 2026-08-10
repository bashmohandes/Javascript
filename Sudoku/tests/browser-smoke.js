/* Dependency-free DOM smoke test for environments without an installed browser. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('Sudoku/index.html', 'utf8');
assert.equal((html.match(/class="tool-icon"/g) || []).length, 4, 'uses one font-independent SVG icon for each game tool');
assert(!/[⌫✎◇▻■]/u.test(html), 'does not use platform-dependent glyphs for game tool icons');

class ClassList {
    constructor(element) { this.element = element; }
    add(...names) {
        const classes = new Set(this.element.className.split(/\s+/).filter(Boolean));
        names.forEach(name => classes.add(name));
        this.element.className = [...classes].join(' ');
    }
    contains(name) { return this.element.className.split(/\s+/).includes(name); }
    toggle(name, force) {
        const enabled = force === undefined ? !this.contains(name) : force;
        if (enabled) this.add(name);
        else this.element.className = this.element.className.split(/\s+/).filter(item => item && item !== name).join(' ');
        return enabled;
    }
}

class Element {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.attributes = {};
        this.dataset = {};
        this.className = '';
        this.textContent = '';
        this.listeners = {};
        this.hidden = false;
        this.disabled = false;
        this.classList = new ClassList(this);
    }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = [...children]; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name]; }
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
    dispatchEvent(event) { (this.listeners[event.type] || []).forEach(listener => listener(event)); }
    click() { this.dispatchEvent({ type: 'click', key: undefined }); }
    focus() { document.activeElement = this; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
        const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
        if (selector === '*') return descendants;
        if (selector.startsWith('.')) return descendants.filter(element => element.classList.contains(selector.slice(1)));
        const dataMatch = selector.match(/^\[data-row="(\d+)"\]\[data-column="(\d+)"\]$/);
        if (dataMatch) return descendants.filter(element => String(element.dataset.row) === dataMatch[1] && String(element.dataset.column) === dataMatch[2]);
        return descendants.filter(element => element.tagName.toLowerCase() === selector);
    }
    set innerHTML(value) { this._innerHTML = value; }
    get innerHTML() { return this._innerHTML || ''; }
}

const elements = new Map();
const register = (id, tagName = 'div') => {
    const element = new Element(tagName);
    elements.set(`#${id}`, element);
    return element;
};

const board = register('board');
register('timer');
register('mistakes');
register('status');
const difficulty = register('difficulty', 'select');
difficulty.value = 'medium';
register('difficulty-label');
const notes = register('notes', 'button');
notes.append(new Element('span'), Object.assign(new Element('small'), { textContent: 'Off' }));
register('finish-modal');
register('erase', 'button');
register('hint', 'button');
const autoSolve = register('auto-solve', 'button');
register('new-game', 'button');
register('new-game-top', 'button');
register('play-again', 'button');
register('finish-summary');
const numberPad = register('number-pad');

global.document = {
    activeElement: null,
    createElement: tagName => new Element(tagName),
    querySelector: selector => elements.get(selector) || null,
    querySelectorAll: selector => [...elements.values()].flatMap(element => {
        const matches = selector.startsWith('.') && element.classList.contains(selector.slice(1)) ? [element] : [];
        return [...matches, ...element.querySelectorAll(selector)];
    }),
    addEventListener(type, listener) { this.listeners ||= {}; (this.listeners[type] ||= []).push(listener); },
    dispatchEvent(event) { (this.listeners?.[event.type] || []).forEach(listener => listener(event)); }
};
global.window = { matchMedia: () => ({ matches: true }) };
const intervalCallbacks = new Map();
let nextIntervalId = 1;
global.setInterval = callback => {
    const id = nextIntervalId++;
    intervalCallbacks.set(id, callback);
    return id;
};
global.clearInterval = id => intervalCallbacks.delete(id);

vm.runInThisContext(fs.readFileSync('Sudoku/scripts/app.js', 'utf8'), { filename: 'Sudoku/scripts/app.js' });

assert.equal(board.children.length, 81, 'renders all 81 grid cells');
assert.equal(numberPad.children.length, 9, 'renders all nine number controls');
assert.equal(board.children.filter(cell => cell.classList.contains('given')).length, 36, 'medium puzzle has 36 given cells');

const boardValue = (row, column) => {
    const label = board.children[row * 9 + column].getAttribute('aria-label');
    return label.endsWith('empty') ? 0 : Number(label.match(/, (\d)/)[1]);
};
const candidatesFor = (row, column) => Array.from({ length: 9 }, (_, index) => index + 1).filter(number => {
    for (let index = 0; index < 9; index++) {
        if (boardValue(row, index) === number || boardValue(index, column) === number) return false;
    }
    const boxRow = Math.floor(row / 3) * 3;
    const boxColumn = Math.floor(column / 3) * 3;
    for (let rowIndex = boxRow; rowIndex < boxRow + 3; rowIndex++) {
        for (let columnIndex = boxColumn; columnIndex < boxColumn + 3; columnIndex++) {
            if (boardValue(rowIndex, columnIndex) === number) return false;
        }
    }
    return true;
});
let trialCell;
for (let row = 0; row < 9 && !trialCell; row++) {
    for (let column = 0; column < 9; column++) {
        if (!boardValue(row, column)) {
            const candidates = candidatesFor(row, column);
            if (candidates.length > 1) trialCell = { row, column, candidates };
        }
    }
}
assert(trialCell, 'generated puzzle has a cell with multiple currently valid candidates');
board.children[trialCell.row * 9 + trialCell.column].click();
numberPad.children[trialCell.candidates[0] - 1].click();
numberPad.children[trialCell.candidates[1] - 1].click();
assert.equal(elements.get('#mistakes').textContent, '0', 'does not penalize alternate candidates that obey Sudoku constraints');
assert.equal(board.children[trialCell.row * 9 + trialCell.column].textContent, trialCell.candidates[1], 'allows a player to revise a valid trial entry');

const emptyCell = board.children.find(cell => cell.getAttribute('aria-label').endsWith('empty'));
emptyCell.click();
notes.click();
numberPad.children[0].click();
const selectedCell = board.children.find(cell => cell.classList.contains('selected'));
assert(selectedCell, 'maintains the selected cell after rendering');
assert(selectedCell.querySelector('.notes-grid').children.some(note => note.textContent === 1), 'adds a pencil note through the number pad');
assert.equal(notes.getAttribute('aria-pressed'), 'true', 'exposes notes mode to assistive technology');

difficulty.value = 'easy';
difficulty.dispatchEvent({ type: 'change' });
assert.equal(board.children.filter(cell => cell.classList.contains('given')).length, 45, 'difficulty changes regenerate the board');

document.dispatchEvent({ type: 'keydown', key: 'ArrowRight' });
assert(document.activeElement?.classList.contains('cell'), 'arrow navigation returns focus to a grid cell');

autoSolve.click();
assert.equal(autoSolve.getAttribute('aria-pressed'), 'true', 'turns the auto-solve control into a stop control');
assert.equal(elements.get('#status').textContent, 'Searching for a solution with backtracking…', 'announces the backtracking solver');
const solveTick = intervalCallbacks.get(Math.max(...intervalCallbacks.keys()));
for (let tick = 0; tick < 10; tick++) solveTick();
autoSolve.click();
assert.equal(elements.get('#status').textContent, 'Auto solve stopped. Your board has been restored.', 'stops solving and restores the playable board');
assert.equal(board.children.filter(cell => cell.getAttribute('aria-label').endsWith('empty')).length, 36, 'removes tentative solver values after stopping');

autoSolve.click();
const restartedSolveTick = intervalCallbacks.get(Math.max(...intervalCallbacks.keys()));
let solverTicks = 0;
while (!elements.get('#status').textContent.startsWith('Solved with') && solverTicks < 250000) {
    restartedSolveTick();
    solverTicks += 1;
}
assert.equal(board.children.filter(cell => cell.getAttribute('aria-label').endsWith('empty')).length, 0, 'auto-solve fills every empty cell');
assert.match(elements.get('#status').textContent, /^Solved with \d+ tries and \d+ backtracks?\.$/, 'reports solver attempts and backtracks');
assert(solverTicks < 250000, 'backtracking solver completes within the safety limit');

console.log('Sudoku DOM smoke test passed');
