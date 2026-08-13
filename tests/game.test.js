'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, startGame, update, setInput, setColor, point } = require('../server/game');
const { predictBall } = require('../pong/scripts/motion');

test('predicts smooth online ball motion without mutating its snapshot', () => {
    const ball = { x: 200, y: 300, r: 10, vx: 400, vy: -100, curveAcceleration: 0, curveTime: 0 };
    const predicted = predictBall(ball, .05);
    assert.ok(Math.abs(predicted.x - 220) < 1e-9);
    assert.ok(Math.abs(predicted.y - 295) < 1e-9);
    assert.deepEqual(ball, { x: 200, y: 300, r: 10, vx: 400, vy: -100, curveAcceleration: 0, curveTime: 0 });
});

test('online ball prediction follows curve acceleration, slow fields, and wall bounces', () => {
    const curved = predictBall({ x: 200, y: 300, r: 10, vx: 400, vy: 0, curveAcceleration: 700, curveTime: .8 }, .05, { movementScale: .72 });
    assert.ok(Math.abs(curved.x - 214.4) < 1e-9);
    assert.ok(curved.y > 300 && curved.vy > 30);
    const bounced = predictBall({ x: 200, y: 12, r: 10, vx: 0, vy: -100, curveAcceleration: 0, curveTime: 0 }, .05);
    assert.ok(bounced.vy > 0);
});

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

test('simulates ordinary event-loop stalls without dropping game time', () => {
    const game = createGame(() => 0.5);
    startGame(game);
    game.serveIn = 0;
    game.balls[0].vx = 100;

    update(game, 0.2);

    assert.ok(Math.abs(game.elapsed - 0.2) < 1e-9);
    assert.ok(Math.abs(game.balls[0].x - 500) < 1e-9);
});

test('uses small physics steps so a fast ball still hits a paddle', () => {
    const game = createGame();
    startGame(game);
    const ball = game.balls[0];
    game.serveIn = 0;
    ball.x = 80;
    ball.y = game.paddles[0].y + game.paddles[0].h / 2;
    ball.vx = -720;
    ball.vy = 0;

    update(game, 0.1);

    assert.ok(ball.vx > 0, 'ball should bounce instead of crossing the paddle');
    assert.deepEqual(game.score, [0, 0]);
});

test('curve shot bends the next return gradually', () => {
    const game = createGame();
    startGame(game);
    const ball = game.balls[0];
    game.serveIn = 0;
    game.effects[0].curve = true;
    ball.x = 58;
    ball.y = game.paddles[0].y + game.paddles[0].h / 2;
    ball.vx = -100;
    ball.vy = 0;

    update(game, 0.01);

    const initialVelocity = ball.vy;
    assert.ok(initialVelocity > 0 && initialVelocity < 20, 'curve shot should begin with acceleration instead of an instant kick');
    assert.ok(ball.curveTime > 0, 'curve shot should remain active after the return');
    assert.equal(game.effects[0].curve, false, 'curve shot should be consumed by the return');

    update(game, 0.2);

    assert.ok(ball.vy > initialVelocity + 100, 'the ball should bend more as it travels');
    assert.ok(ball.curveTime < 0.8, 'the curve duration should count down during flight');
});

test('a split-ball decoy can leave the arena without awarding a point', () => {
    const game = createGame();
    startGame(game);
    game.serveIn = 0;
    game.balls.push({ ...game.balls[0], x: -31, vx: -100, decoy: true });

    update(game, 0.01);

    assert.deepEqual(game.score, [0, 0]);
    assert.equal(game.balls.length, 1);
    assert.equal(game.balls[0].decoy, false);
});

test('a decoy return does not consume a queued curve shot', () => {
    const game = createGame();
    startGame(game);
    game.serveIn = 0;
    game.effects[0].curve = true;
    game.balls.push({ ...game.balls[0], x: 58, y: 300, vx: -100, vy: 0, decoy: true });

    update(game, 0.01);

    assert.equal(game.effects[0].curve, true);
});

test('a rematch clears stale input and winner state', () => {
    const game = createGame();
    startGame(game);
    setInput(game, 0, { down: true, targetY: 500 });
    for (let score = 0; score < 7; score += 1) point(game, 0);

    startGame(game);

    assert.equal(game.winner, undefined);
    assert.deepEqual(game.inputs, [
        { up: false, down: false, targetY: null },
        { up: false, down: false, targetY: null }
    ]);
});
