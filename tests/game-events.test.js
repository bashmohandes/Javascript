'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createArcadeEvents } = require('../scripts/game-events.js');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function environment(pathname = '/tetris/') {
    const errors = [];
    return { env: { location: { pathname }, performance: { now: () => 42 }, console: { error: (...items) => errors.push(items) } }, errors };
}

test('event envelopes are ordered, frozen, and identify the game page', () => {
    const { env } = environment();
    const events = createArcadeEvents(env), received = [];
    events.on('tetris:lines-cleared', event => received.push(event));
    const first = events.emit('tetris:lines-cleared', { count: 4, rows: [16,17,18,19] });
    const second = events.emit('tetris:lines-cleared', { count: 1 });
    assert.deepEqual(received, [first, second]);
    assert.deepEqual({ version: first.version, id: first.id, type: first.type, game: first.game, source: first.source, timestamp: first.timestamp }, { version: 1, id: 1, type: 'tetris:lines-cleared', game: 'tetris', source: 'client', timestamp: 42 });
    assert.equal(second.id, 2);
    assert.ok(Object.isFrozen(first)); assert.ok(Object.isFrozen(first.detail));
});

test('unsubscribe, once, wildcard, and AbortSignal control listener lifetime', () => {
    const { env } = environment('/pong/');
    const events = createArcadeEvents(env), received = [], controller = new AbortController();
    const off = events.on('*', event => received.push(`all:${event.type}`));
    events.once('pong:served', () => received.push('once'));
    events.on('pong:served', () => received.push('signal'), { signal: controller.signal });
    events.emit('pong:served'); controller.abort(); events.emit('pong:served'); off(); events.emit('pong:served');
    assert.deepEqual(received, ['once','signal','all:pong:served','all:pong:served']);
});

test('listener failures are isolated and invalid contracts are rejected', () => {
    const { env, errors } = environment();
    const events = createArcadeEvents(env); let delivered = false;
    events.on('game:started', () => { throw new Error('consumer failed'); });
    events.on('game:started', () => { delivered = true; });
    events.emit('game:started', { mode: 'marathon' });
    assert.equal(delivered, true); assert.equal(errors.length, 1);
    assert.throws(() => events.emit('Bad event'), /Invalid arcade event type/);
    assert.throws(() => events.emit('game:started', []), /detail must be an object/);
    assert.throws(() => events.on('game:started', null), /listeners must be functions/);
});

test('modern controllers publish domain facts without importing audio', () => {
    const games = ['pong', 'tictactoe', 'battle-tanks', 'Sudoku', 'Minesweeper', 'tetris'];
    for (const game of games) {
        const html = read(`${game}/index.html`), app = read(`${game}/scripts/app.js`);
        assert.match(html, /scripts\/game-events\.js[\s\S]*scripts\/audio\.js/, `${game} should load events before audio`);
        assert.match(app, /ArcadeEvents/); assert.match(app, /events\.emit\(/);
        assert.doesNotMatch(app, /ArcadeAudio|\.cue\(|setScene\(/, `${game} should not depend on audio`);
    }
    assert.match(read('scripts/audio.js'), /events\.on\(type, listener\)/);
    assert.match(read('scripts/audio.js'), /'game:completed'/);
});

test('shared shell notifications and extension boundaries use the event contract', () => {
    const shell = read('arcade.js'), guide = read('docs/game-events.md'), adr = read('docs/adr/0014-browser-domain-event-bus.md');
    for (const page of ['index.html','profile.html']) assert.match(read(page), /scripts\/game-events\.js[\s\S]*arcade\.js/);
    for (const type of ['system:theme-changed','account:user-changed','achievement:unlocked','score:top']) assert.match(shell, new RegExp(type));
    assert.match(read('profile.js'), /account:user-changed/);
    assert.match(guide, /not a command bus, durable event log, WebSocket protocol, or trust boundary/);
    assert.match(guide, /server-normalized[\s\S]*server\/achievements\.js/);
    assert.match(adr, /page-local event[\s\S]*Server-derived scores/);
    assert.match(read('service-worker.js'), /scripts\/game-events\.js/);
});
