(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.PongMotion = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function predictBall(source, elapsed, { width = 960, height = 600, snapshotElapsed = 0, effects = [{}, {}], paddles = [] } = {}) {
        if (!source) return null;
        const ball = { ...source };
        const predictedEffects = effects.map(effect => ({ ...effect }));
        let remaining = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
        let simulationElapsed = Number.isFinite(snapshotElapsed) ? snapshotElapsed : 0;
        while (remaining > 0) {
            const step = Math.min(remaining, 1 / 120);
            simulationElapsed += step;
            const slowed = ((predictedEffects[0]?.slowUntil || 0) > simulationElapsed && ball.x < width / 2) || ((predictedEffects[1]?.slowUntil || 0) > simulationElapsed && ball.x > width / 2);
            const movementScale = slowed ? 0.72 : 1;
            if ((ball.curveTime || 0) > 0) {
                const curveStep = Math.min(step, ball.curveTime);
                ball.vy += (ball.curveAcceleration || 0) * curveStep;
                ball.curveTime = Math.max(0, ball.curveTime - step);
                if (ball.curveTime === 0) ball.curveAcceleration = 0;
            }
            ball.x += ball.vx * step * movementScale;
            ball.y += ball.vy * step * movementScale;
            if ((ball.y - ball.r < 10 && ball.vy < 0) || (ball.y + ball.r > height - 10 && ball.vy > 0)) ball.vy *= -1;
            paddles.forEach((paddle, side) => {
                const toward = side === 0 ? ball.vx < 0 : ball.vx > 0;
                if (!toward || ball.x + ball.r <= paddle.x || ball.x - ball.r >= paddle.x + paddle.w || ball.y + ball.r <= paddle.y || ball.y - ball.r >= paddle.y + paddle.h) return;
                const offset = (ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2);
                ball.x = side === 0 ? paddle.x + paddle.w + ball.r : paddle.x - ball.r;
                ball.vx = (side === 0 ? 1 : -1) * Math.min(Math.abs(ball.vx) * 1.055, 720);
                ball.vy = offset * 430;
                if (!ball.decoy && predictedEffects[side]?.curve) {
                    ball.curveAcceleration = (offset >= 0 ? 1 : -1) * 700;
                    ball.curveTime = 0.8;
                    predictedEffects[side].curve = false;
                }
            });
            remaining -= step;
        }
        return ball;
    }

    return { predictBall };
}));
