'use strict';

const WIDTH = 960;
const HEIGHT = 600;
const WIN_SCORE = 7;
const PADDLE_SPEED = 500;

function makeBall() {
    return { x: WIDTH / 2, y: HEIGHT / 2, r: 10, vx: 0, vy: 0 };
}

function createGame(random = Math.random) {
    return {
        width: WIDTH,
        height: HEIGHT,
        running: false,
        paused: true,
        over: false,
        score: [0, 0],
        serve: random() < 0.5 ? -1 : 1,
        serveIn: 0,
        elapsed: 0,
        lastTouch: 0,
        nextPowerUp: 5,
        paddles: [
            { x: 34, y: 240, w: 14, h: 120, baseH: 120, color: '#fffdf8' },
            { x: 912, y: 240, w: 14, h: 120, baseH: 120, color: '#d76b45' }
        ],
        balls: [makeBall()],
        inputs: [{ up: false, down: false, targetY: null }, { up: false, down: false, targetY: null }],
        effects: [{}, {}],
        powerUps: [],
        random
    };
}

function startGame(game) {
    game.running = true;
    game.paused = false;
    game.over = false;
    game.winner = undefined;
    game.score = [0, 0];
    game.elapsed = 0;
    game.nextPowerUp = 5;
    game.powerUps = [];
    game.effects = [{}, {}];
    game.inputs = [{ up: false, down: false, targetY: null }, { up: false, down: false, targetY: null }];
    game.paddles.forEach(paddle => { paddle.y = 240; paddle.h = paddle.baseH; });
    resetBall(game, game.serve, 0.75);
}

function resetBall(game, direction, delay = 0.65) {
    game.balls = [makeBall()];
    game.serve = direction;
    game.serveIn = delay;
}

function launch(game) {
    const angle = game.random() * 0.8 - 0.4;
    game.balls[0].vx = game.serve * 410 * Math.cos(angle);
    game.balls[0].vy = 410 * Math.sin(angle);
    game.serve *= -1;
    game.serveIn = 0;
}

function setInput(game, side, input) {
    if (side !== 0 && side !== 1) return;
    game.inputs[side] = {
        up: Boolean(input.up),
        down: Boolean(input.down),
        targetY: Number.isFinite(input.targetY) ? Math.max(0, Math.min(HEIGHT, input.targetY)) : null
    };
}

function setColor(game, side, color) {
    if ((side === 0 || side === 1) && /^#[0-9a-f]{6}$/i.test(color)) game.paddles[side].color = color;
}

const powerUpTypes = {
    reach: { collection: 'paddle' }, quick: { collection: 'paddle' }, curve: { collection: 'paddle' },
    slow: { collection: 'paddle' }, burst: { collection: 'ball' }, split: { collection: 'ball' }
};

function schedulePowerUp(game) { game.nextPowerUp = game.elapsed + 8 + game.random() * 6; }

function spawnPowerUp(game) {
    const paddlePickup = game.random() < 0.68;
    const types = paddlePickup ? ['reach', 'quick', 'curve', 'slow'] : ['burst', 'split'];
    const type = types[Math.floor(game.random() * types.length)];
    const side = game.random() < 0.5 ? 0 : 1;
    const y = 55 + game.random() * (HEIGHT - 110);
    game.powerUps.push({
        id: `${Math.round(game.elapsed * 1000)}-${Math.floor(game.random() * 100000)}`,
        type, side, x: paddlePickup ? (side ? 898 : 62) : 300 + game.random() * 360,
        y, r: paddlePickup ? 17 : 20, expires: game.elapsed + (paddlePickup ? 5 : 7)
    });
    schedulePowerUp(game);
}

function collect(game, powerUp, side) {
    const effect = game.effects[side];
    if (powerUp.type === 'reach') effect.reachUntil = game.elapsed + 8;
    if (powerUp.type === 'quick') effect.quickUntil = game.elapsed + 7;
    if (powerUp.type === 'curve') effect.curve = true;
    if (powerUp.type === 'slow') effect.slowUntil = game.elapsed + 6;
    if (powerUp.type === 'burst') game.balls.forEach(ball => { ball.vx *= 1.22; ball.vy *= 1.22; });
    if (powerUp.type === 'split' && game.balls.length === 1) {
        const ball = game.balls[0];
        game.balls.push({ ...ball, vy: -ball.vy || 260 });
    }
    game.powerUps = game.powerUps.filter(item => item !== powerUp);
}

function point(game, side) {
    game.score[side] += 1;
    game.powerUps = [];
    game.effects = [{}, {}];
    game.paddles.forEach(paddle => { paddle.h = paddle.baseH; });
    if (game.score[side] >= WIN_SCORE) {
        game.over = true;
        game.running = false;
        game.paused = true;
        game.winner = side;
    } else resetBall(game, side === 0 ? 1 : -1);
}

function updateStep(game, step) {
    if (!game.running || game.paused || game.over) return;
    game.elapsed += step;
    if (game.serveIn > 0) {
        game.serveIn -= step;
        if (game.serveIn <= 0) launch(game);
    }
    if (game.elapsed >= game.nextPowerUp && game.powerUps.length < 2) spawnPowerUp(game);
    game.powerUps = game.powerUps.filter(powerUp => powerUp.expires > game.elapsed);

    game.paddles.forEach((paddle, side) => {
        const input = game.inputs[side];
        const center = paddle.y + paddle.h / 2;
        paddle.h = (game.effects[side].reachUntil || 0) > game.elapsed ? 162 : paddle.baseH;
        paddle.y = center - paddle.h / 2;
        const speed = (game.effects[side].quickUntil || 0) > game.elapsed ? 625 : PADDLE_SPEED;
        if (input.targetY !== null) paddle.y = input.targetY - paddle.h / 2;
        else paddle.y += ((input.down ? speed : 0) - (input.up ? speed : 0)) * step;
        paddle.y = Math.max(12, Math.min(HEIGHT - paddle.h - 12, paddle.y));
    });

    game.powerUps.slice().forEach(powerUp => {
        if (powerUpTypes[powerUp.type].collection !== 'paddle') return;
        const paddle = game.paddles[powerUp.side];
        if (powerUp.x + powerUp.r > paddle.x && powerUp.x - powerUp.r < paddle.x + paddle.w && powerUp.y + powerUp.r > paddle.y && powerUp.y - powerUp.r < paddle.y + paddle.h) collect(game, powerUp, powerUp.side);
    });

    for (const ball of game.balls) {
        const slowed = ((game.effects[0].slowUntil || 0) > game.elapsed && ball.x < WIDTH / 2) || ((game.effects[1].slowUntil || 0) > game.elapsed && ball.x > WIDTH / 2);
        const movement = step * (slowed ? 0.72 : 1);
        ball.x += ball.vx * movement;
        ball.y += ball.vy * movement;
        if ((ball.y - ball.r < 10 && ball.vy < 0) || (ball.y + ball.r > HEIGHT - 10 && ball.vy > 0)) ball.vy *= -1;
        game.paddles.forEach((paddle, side) => {
            const toward = side === 0 ? ball.vx < 0 : ball.vx > 0;
            if (!toward || ball.x + ball.r <= paddle.x || ball.x - ball.r >= paddle.x + paddle.w || ball.y + ball.r <= paddle.y || ball.y - ball.r >= paddle.y + paddle.h) return;
            const offset = (ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2);
            ball.x = side === 0 ? paddle.x + paddle.w + ball.r : paddle.x - ball.r;
            ball.vx = (side === 0 ? 1 : -1) * Math.min(Math.abs(ball.vx) * 1.055, 720);
            ball.vy = offset * 430;
            if (game.effects[side].curve) { ball.vy += (offset >= 0 ? 1 : -1) * 220; game.effects[side].curve = false; }
            game.lastTouch = side;
        });
        game.powerUps.slice().forEach(powerUp => {
            if (powerUpTypes[powerUp.type].collection === 'ball' && Math.hypot(ball.x - powerUp.x, ball.y - powerUp.y) < ball.r + powerUp.r) collect(game, powerUp, game.lastTouch);
        });
        if (ball.x < -30) { point(game, 1); return; }
        if (ball.x > WIDTH + 30) { point(game, 0); return; }
    }
}

function update(game, dt) {
    // Preserve elapsed simulation time during ordinary event-loop stalls while
    // keeping each physics step small enough that a fast ball cannot tunnel
    // through a paddle. Cap very long stalls to avoid a spiral of death.
    let remaining = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 0.25);
    while (remaining > 0 && game.running && !game.paused && !game.over) {
        const step = Math.min(remaining, 1 / 120);
        updateStep(game, step);
        remaining -= step;
    }
}

function snapshot(game) {
    return {
        width: game.width, height: game.height, running: game.running, paused: game.paused, over: game.over,
        score: game.score, elapsed: game.elapsed, winner: game.winner, paddles: game.paddles,
        balls: game.balls, powerUps: game.powerUps, effects: game.effects
    };
}

module.exports = { WIDTH, HEIGHT, WIN_SCORE, createGame, startGame, update, setInput, setColor, snapshot, point };
