(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.BattleTanksCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const WIDTH = 960, HEIGHT = 540, GROUND = 488, GRAVITY = 210;
    const TANK_W = 58, TANK_H = 30, PROJECTILE_R = 6;
    const STARTING_HEALTH = 100, DAMAGE = 50;
    const barrier = { x: 448, y: 266, w: 64, h: GROUND - 266 };
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    function createInitialState() {
        return {
            phase: 'setup', activePlayer: 0,
            tanks: [
                { x: 115, y: GROUND - TANK_H, angle: 45, power: 60, health: STARTING_HEALTH },
                { x: WIDTH - 115 - TANK_W, y: GROUND - TANK_H, angle: 45, power: 60, health: STARTING_HEALTH }
            ],
            projectile: null, winner: null, shots: 0, hits: 0, impacts: [], impactSerial: 0, lastImpact: null,
            startedAt: Date.now(), resultSubmitted: false,
            announcement: 'Preparing the arena.'
        };
    }
    function beginTurn(state, player = state.activePlayer) {
        if (state.phase === 'game-over') return false;
        state.activePlayer = player; state.phase = 'aiming'; state.projectile = null;
        state.announcement = `Player ${player + 1}: adjust your shot.`;
        return true;
    }
    function tankBounds(player) { return player === 0 ? { min: 0, max: barrier.x - TANK_W } : { min: barrier.x + barrier.w, max: WIDTH - TANK_W }; }
    function moveTank(state, direction, amount = 8) {
        if (state.phase !== 'aiming') return false;
        const tank = state.tanks[state.activePlayer], bounds = tankBounds(state.activePlayer);
        tank.x = clamp(tank.x + (direction === 'forward' ? (state.activePlayer ? -amount : amount) : (state.activePlayer ? amount : -amount)), bounds.min, bounds.max);
        return true;
    }
    function adjustAim(state, delta) { if (state.phase !== 'aiming') return false; const tank = state.tanks[state.activePlayer]; tank.angle = clamp(tank.angle + delta, 10, 80); return true; }
    function adjustPower(state, delta) { if (state.phase !== 'aiming') return false; const tank = state.tanks[state.activePlayer]; tank.power = clamp(tank.power + delta, 20, 100); return true; }
    function fireProjectile(state) {
        if (state.phase !== 'aiming') return false;
        const tank = state.tanks[state.activePlayer], direction = state.activePlayer ? -1 : 1;
        const radians = tank.angle * Math.PI / 180, speed = 170 + tank.power * 3.2;
        state.shots += 1;
        state.projectile = { x: tank.x + TANK_W / 2 + direction * 32, y: tank.y - 7, vx: Math.cos(radians) * speed * direction, vy: -Math.sin(radians) * speed, owner: state.activePlayer };
        state.phase = 'projectile-flight'; state.announcement = `Player ${state.activePlayer + 1} fired.`;
        return true;
    }
    function predictProjectile(projectile, elapsed = 0) {
        if (!projectile) return null;
        const seconds = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
        return {
            ...projectile,
            x: projectile.x + projectile.vx * seconds,
            y: projectile.y + projectile.vy * seconds + 0.5 * GRAVITY * seconds * seconds,
            vy: projectile.vy + GRAVITY * seconds
        };
    }
    function circleRect(x, y, r, rect) { return x + r >= rect.x && x - r <= rect.x + rect.w && y + r >= rect.y && y - r <= rect.y + rect.h; }
    function resolveShot(state, hit) {
        const point = state.projectile && Number.isFinite(state.projectile.x) ? { x: state.projectile.x, y: state.projectile.y } : null;
        state.projectile = null;
        if (hit && point) {
            state.impactSerial = (state.impactSerial || 0) + 1;
            state.lastImpact = { ...point, type: hit.type, index: hit.index, serial: state.impactSerial };
            if (hit.type === 'terrain' || hit.type === 'barrier') state.impacts = [...(state.impacts || []), state.lastImpact].slice(-14);
        }
        if (hit && hit.type === 'tank') {
            state.hits += 1;
            const target = state.tanks[hit.index]; target.health = Math.max(0, target.health - DAMAGE);
            if (target.health === 0) { state.phase = 'game-over'; state.winner = 1 - hit.index; state.announcement = `Player ${state.winner + 1} wins!`; return hit; }
        }
        state.activePlayer = 1 - state.activePlayer; state.phase = 'aiming';
        state.announcement = hit?.type === 'tank' ? `Direct hit! Player ${state.activePlayer + 1}'s turn.` : `Shot ended. Player ${state.activePlayer + 1}'s turn.`;
        return hit;
    }
    function collisionAt(state, x, y) {
        if (circleRect(x, y, PROJECTILE_R, barrier)) return { type: 'barrier' };
        for (let index = 0; index < state.tanks.length; index += 1) {
            const tank = state.tanks[index];
            if (circleRect(x, y, PROJECTILE_R, { x: tank.x, y: tank.y, w: TANK_W, h: TANK_H })) return { type: 'tank', index };
        }
        if (y + PROJECTILE_R >= GROUND) return { type: 'terrain' };
        if (x + PROJECTILE_R < 0 || x - PROJECTILE_R > WIDTH || y + PROJECTILE_R < 0 || y - PROJECTILE_R > HEIGHT) return { type: 'out-of-bounds' };
        return null;
    }
    function stepPhysics(state, dt = 1 / 120) {
        if (state.phase !== 'projectile-flight' || !state.projectile) return null;
        if (!Number.isFinite(dt) || dt <= 0) return null;
        const projectile = state.projectile;
        // Follow the parabola in short time slices as well as short distance slices.
        // Sampling only the straight chord between two distant endpoints can miss a
        // target below the apex when a browser frame is heavily delayed.
        const durationSteps = Math.ceil(dt / (1 / 120));
        const distanceSteps = Math.ceil(Math.max(Math.abs(projectile.vx * dt), Math.abs(projectile.vy * dt + 0.5 * GRAVITY * dt * dt)) / 3);
        const steps = Math.max(1, durationSteps, distanceSteps), step = dt / steps;
        for (let index = 0; index < steps; index += 1) {
            const dx = projectile.vx * step, dy = projectile.vy * step + 0.5 * GRAVITY * step * step;
            const hit = collisionAt(state, projectile.x + dx, projectile.y + dy);
            projectile.x += dx; projectile.y += dy; projectile.vy += GRAVITY * step;
            if (hit) return resolveShot(state, hit);
        }
        return null;
    }
    function resetMatch(state) { const fresh = createInitialState(); Object.keys(state).forEach(key => delete state[key]); Object.assign(state, fresh); beginTurn(state, 0); return state; }
    function snapshot(state) { return { phase: state.phase, activePlayer: state.activePlayer, tanks: state.tanks.map(tank => ({ ...tank })), projectile: state.projectile ? { ...state.projectile } : null, winner: state.winner, shots: state.shots, hits: state.hits, impacts: (state.impacts || []).map(impact => ({ ...impact })), impactSerial: state.impactSerial || 0, lastImpact: state.lastImpact ? { ...state.lastImpact } : null, announcement: state.announcement }; }

    return { WIDTH, HEIGHT, GROUND, GRAVITY, TANK_W, TANK_H, PROJECTILE_R, STARTING_HEALTH, DAMAGE, barrier, createInitialState, beginTurn, tankBounds, moveTank, adjustAim, adjustPower, fireProjectile, predictProjectile, collisionAt, stepPhysics, resolveShot, resetMatch, snapshot };
}));
