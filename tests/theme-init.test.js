'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('theme-init.js', 'utf8');

const resolveTheme = (preference, systemDark = false) => {
    const documentElement = { dataset: {}, style: {} };
    vm.runInNewContext(source, {
        document: { documentElement },
        localStorage: { getItem: () => preference },
        matchMedia: () => ({ matches: systemDark })
    });
    return documentElement;
};

test('initial theme follows the system when no override is saved', () => {
    assert.equal(resolveTheme(null, true).dataset.theme, 'dark');
    assert.equal(resolveTheme(null, false).dataset.theme, 'light');
});

test('initial theme honors an explicit preference', () => {
    assert.equal(resolveTheme('light', true).dataset.theme, 'light');
    assert.equal(resolveTheme('dark', false).dataset.theme, 'dark');
});

test('invalid preferences fall back to the system', () => {
    assert.equal(resolveTheme('sepia', true).dataset.theme, 'dark');
});
