(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.PongMotion = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function predictBall(source, elapsed, { height = 600, movementScale = 1 } = {}) {
        if (!source) return null;
        const ball = { ...source };
        let remaining = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
        const scale = Number.isFinite(movementScale) ? Math.max(0, movementScale) : 1;
        while (remaining > 0) {
            const step = Math.min(remaining, 1 / 120);
            if ((ball.curveTime || 0) > 0) {
                const curveStep = Math.min(step, ball.curveTime);
                ball.vy += (ball.curveAcceleration || 0) * curveStep;
                ball.curveTime = Math.max(0, ball.curveTime - step);
                if (ball.curveTime === 0) ball.curveAcceleration = 0;
            }
            ball.x += ball.vx * step * scale;
            ball.y += ball.vy * step * scale;
            if ((ball.y - ball.r < 10 && ball.vy < 0) || (ball.y + ball.r > height - 10 && ball.vy > 0)) ball.vy *= -1;
            remaining -= step;
        }
        return ball;
    }

    return { predictBall };
}));
