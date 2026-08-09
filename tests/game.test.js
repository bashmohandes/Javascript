'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, startGame, update, setInput, setColor, point } = require('../server/game');

test('starts a fresh first-to-seven match', () => {
    const game = createGame(() => 0.25);
    startGame(game);
    assert.equal(game.running, true);
    assert.equal(game.paused, false);
    assert.deepEqual(game.score, [0, 0]);
    for (let tick = 0; tick < 16; tick += 1) update(game, 0.05);
    assert.notEqual(game.balls[0].vx, 0);
});

test('validates input and paddle colors', () => {
    const game = createGame();
    startGame(game);
    setInput(game, 0, { down: true });
    update(game, 0.05);
    assert.ok(game.paddles[0].y > 240);
    setColor(game, 0, 'not-a-color');
    assert.equal(game.paddles[0].color, '#fffdf8');
    setColor(game, 0, '#112233');
    assert.equal(game.paddles[0].color, '#112233');
});

test('ends the match when a player reaches seven', () => {
    const game = createGame();
    startGame(game);
    for (let score = 0; score < 7; score += 1) point(game, 1);
    assert.deepEqual(game.score, [0, 7]);
    assert.equal(game.over, true);
    assert.equal(game.winner, 1);
});
