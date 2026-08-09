/* Dependency-free DOM smoke test for environments without an installed browser. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class ClassList {
    constructor(element) { this.element = element; }
    add(...names) {
        const classes = new Set(this.element.className.split(/\s+/).filter(Boolean));
        names.forEach(name => classes.add(name));
        this.element.className = [...classes].join(' ');
    }
    contains(name) { return this.element.className.split(/\s+/).includes(name); }
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
global.setInterval = () => 1;
global.clearInterval = () => {};

vm.runInThisContext(fs.readFileSync('Sudoku/scripts/app.js', 'utf8'), { filename: 'Sudoku/scripts/app.js' });

assert.equal(board.children.length, 81, 'renders all 81 grid cells');
assert.equal(numberPad.children.length, 9, 'renders all nine number controls');
assert.equal(board.children.filter(cell => cell.classList.contains('given')).length, 36, 'medium puzzle has 36 given cells');

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

console.log('Sudoku DOM smoke test passed');
