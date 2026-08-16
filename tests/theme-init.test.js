'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('theme-init.js', 'utf8');

const resolveTheme = (preferences = {}, systemDark = false) => {
    const documentElement = { dataset: {}, style: {} };
    const storage = new Map(Object.entries(preferences));
    vm.runInNewContext(source, {
        document: { documentElement },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        matchMedia: () => ({ matches: systemDark }),
        window: {}
    });
    return { root: documentElement, storage };
};

test('initial theme follows the system when no override is saved', () => {
    assert.equal(resolveTheme({}, true).root.dataset.colorMode, 'dark');
    assert.equal(resolveTheme({}, false).root.dataset.colorMode, 'light');
});

test('initial theme honors an explicit preference', () => {
    assert.equal(resolveTheme({ 'arcade-color-preference': 'light' }, true).root.dataset.colorMode, 'light');
    assert.equal(resolveTheme({ 'arcade-color-preference': 'dark' }, false).root.dataset.colorMode, 'dark');
});

test('invalid preferences fall back to the system', () => {
    assert.equal(resolveTheme({ 'arcade-color-preference': 'sepia' }, true).root.dataset.colorMode, 'dark');
});

test('initial theme validates experience choices independently from color mode', () => {
    assert.equal(resolveTheme({ 'arcade-experience-theme': 'cabinet' }).root.dataset.arcadeTheme, 'cabinet');
    assert.equal(resolveTheme({ 'arcade-experience-theme': 'unknown' }).root.dataset.arcadeTheme, 'playful');
});

test('legacy light and dark preferences migrate to the new color key', () => {
    const result = resolveTheme({ 'arcade-theme': 'dark' });
    assert.equal(result.root.dataset.colorMode, 'dark');
    assert.equal(result.storage.get('arcade-color-preference'), 'dark');
});
