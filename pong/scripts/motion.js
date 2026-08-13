(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.PongMotion = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function predictBall(source, elapsed, { width = 960, height = 600, snapshotElapsed = 0, effects = [{}, {}] } = {}) {
        if (!source) return null;
        const ball = { ...source };
        let remaining = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
        let simulationElapsed = Number.isFinite(snapshotElapsed) ? snapshotElapsed : 0;
        while (remaining > 0) {
            const step = Math.min(remaining, 1 / 120);
            simulationElapsed += step;
            const slowed = ((effects[0]?.slowUntil || 0) > simulationElapsed && ball.x < width / 2) || ((effects[1]?.slowUntil || 0) > simulationElapsed && ball.x > width / 2);
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
            remaining -= step;
        }
        return ball;
    }

    return { predictBall };
}));
