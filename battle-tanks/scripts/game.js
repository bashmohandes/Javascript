(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.BattleTanksCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const WIDTH = 960, HEIGHT = 540, GRAVITY = 210;
    const TANK_W = 58, TANK_H = 30, PROJECTILE_R = 6;
    const STARTING_HEALTH = 100, DAMAGE = 50, TERRAIN_STEP = 8;
    // Arena guarantees used by both generation and tests/UI: terrain stays in
    // this vertical band and the centre wall varies without trapping either tank.
    const ARENA_LIMITS = Object.freeze({ terrainMin: 410, terrainMax: 500, barrierWidthMin: 52, barrierWidthMax: 84, barrierHeightMin: 145, barrierHeightMax: 215, sideSpaceMin: 350 });
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    function seedValue(seed) {
        if (Number.isFinite(seed)) return Number(seed) >>> 0;
        let value = 2166136261;
        for (const character of String(seed ?? 'battle-tanks')) { value ^= character.charCodeAt(0); value = Math.imul(value, 16777619); }
        return value >>> 0;
    }
    function seededRandom(seed) {
        let value = seedValue(seed);
        return function random() { value += 0x6D2B79F5; let result = value; result = Math.imul(result ^ result >>> 15, result | 1); result ^= result + Math.imul(result ^ result >>> 7, result | 61); return ((result ^ result >>> 14) >>> 0) / 4294967296; };
    }
    function generateArena(seed = Date.now()) {
        const normalizedSeed = seedValue(seed), random = seededRandom(normalizedSeed), count = WIDTH / TERRAIN_STEP + 1;
        let terrain = Array.from({ length: count }, (_, index) => {
            const x = index * TERRAIN_STEP;
            return 458 + Math.sin(x / 92 + random() * 1.4) * 24 + (random() - .5) * 30;
        });
        // Repeated neighbourhood averaging produces broad, traversable hills rather than noise.
        for (let pass = 0; pass < 5; pass += 1) terrain = terrain.map((height, index, values) => (values[Math.max(0, index - 1)] + height * 2 + values[Math.min(values.length - 1, index + 1)]) / 4);
        terrain = terrain.map(height => Math.round(clamp(height, ARENA_LIMITS.terrainMin, ARENA_LIMITS.terrainMax) * 10) / 10);
        // Flat safe pads cover the complete initial footprint and a useful movement
        // margin. Smoothstep shoulders join each pad to the existing hills so a
        // tank cannot encounter a cliff at the edge of its spawn region.
        const flattenPad = (from, to, shoulder = 64) => {
            const fromIndex = from / TERRAIN_STEP, toIndex = to / TERRAIN_STEP;
            const leftIndex = Math.max(0, (from - shoulder) / TERRAIN_STEP), rightIndex = Math.min(terrain.length - 1, (to + shoulder) / TERRAIN_STEP);
            const level = terrain[Math.round((fromIndex + toIndex) / 2)], leftHeight = terrain[leftIndex], rightHeight = terrain[rightIndex];
            const smoothstep = value => value * value * (3 - 2 * value);
            for (let index = leftIndex; index < fromIndex; index += 1) { const blend = smoothstep((index - leftIndex) / (fromIndex - leftIndex)); terrain[index] = leftHeight * (1 - blend) + level * blend; }
            for (let index = fromIndex; index <= toIndex; index += 1) terrain[index] = level;
            for (let index = toIndex + 1; index <= rightIndex; index += 1) { const blend = smoothstep((index - toIndex) / (rightIndex - toIndex)); terrain[index] = level * (1 - blend) + rightHeight * blend; }
        };
        flattenPad(56, 248); flattenPad(712, 904);
        terrain = terrain.map(height => Math.round(height * 10) / 10);
        const w = Math.round(ARENA_LIMITS.barrierWidthMin + random() * (ARENA_LIMITS.barrierWidthMax - ARENA_LIMITS.barrierWidthMin));
        const xMin = ARENA_LIMITS.sideSpaceMin, xMax = WIDTH - ARENA_LIMITS.sideSpaceMin - w;
        const x = Math.round(xMin + random() * (xMax - xMin));
        const heightAt = position => { const sample = position / TERRAIN_STEP, left = Math.floor(sample), mix = sample - left; return terrain[left] * (1 - mix) + terrain[Math.min(terrain.length - 1, left + 1)] * mix; };
        // Sink the wall down to the lowest ground (largest canvas Y) across its
        // entire footprint. It may overlap higher terrain, but can never float
        // above a valley and leave a projectile-sized passage underneath.
        const footprint = [heightAt(x), heightAt(x + w)];
        for (let sampleX = Math.ceil(x / TERRAIN_STEP) * TERRAIN_STEP; sampleX < x + w; sampleX += TERRAIN_STEP) footprint.push(heightAt(sampleX));
        const surface = Math.max(...footprint);
        const h = Math.round(ARENA_LIMITS.barrierHeightMin + random() * (ARENA_LIMITS.barrierHeightMax - ARENA_LIMITS.barrierHeightMin));
        return { seed: normalizedSeed, terrain, barrier: { x, y: surface - h, w, h } };
    }
    function terrainHeightAt(arena, x) {
        if (!arena?.terrain?.length) return HEIGHT;
        const position = clamp(x, 0, WIDTH) / TERRAIN_STEP, left = Math.floor(position), right = Math.min(arena.terrain.length - 1, left + 1), mix = position - left;
        return arena.terrain[left] * (1 - mix) + arena.terrain[right] * mix;
    }
    function tankYAt(state, tank) { return terrainHeightAt(state.arena, tank.x + TANK_W / 2) - TANK_H; }
    function tankBounds(state, player) { const barrier = state.arena.barrier; return player === 0 ? { min: 0, max: barrier.x - TANK_W } : { min: barrier.x + barrier.w, max: WIDTH - TANK_W }; }
    function createInitialState(seed) {
        const arena = generateArena(seed), tanks = [
            { x: 115, angle: 45, power: 60, health: STARTING_HEALTH },
            { x: WIDTH - 115 - TANK_W, angle: 45, power: 60, health: STARTING_HEALTH }
        ];
        const state = { phase: 'setup', activePlayer: 0, arena, tanks, projectile: null, winner: null, shots: 0, hits: 0, impacts: [], impactSerial: 0, lastImpact: null, startedAt: Date.now(), resultSubmitted: false, announcement: 'Preparing the arena.' };
        tanks.forEach(tank => { tank.y = tankYAt(state, tank); });
        return state;
    }
    function beginTurn(state, player = state.activePlayer) { if (state.phase === 'game-over') return false; state.activePlayer = player; state.phase = 'aiming'; state.projectile = null; state.announcement = `Player ${player + 1}: adjust your shot.`; return true; }
    function moveTank(state, direction, amount = 8) { if (state.phase !== 'aiming') return false; const tank = state.tanks[state.activePlayer], bounds = tankBounds(state, state.activePlayer); tank.x = clamp(tank.x + (direction === 'forward' ? (state.activePlayer ? -amount : amount) : (state.activePlayer ? amount : -amount)), bounds.min, bounds.max); tank.y = tankYAt(state, tank); return true; }
    function adjustAim(state, delta) { if (state.phase !== 'aiming') return false; const tank = state.tanks[state.activePlayer]; tank.angle = clamp(tank.angle + delta, 10, 80); return true; }
    function adjustPower(state, delta) { if (state.phase !== 'aiming') return false; const tank = state.tanks[state.activePlayer]; tank.power = clamp(tank.power + delta, 20, 100); return true; }
    function fireProjectile(state) { if (state.phase !== 'aiming') return false; const tank = state.tanks[state.activePlayer], direction = state.activePlayer ? -1 : 1, radians = tank.angle * Math.PI / 180, speed = 170 + tank.power * 3.2; tank.y = tankYAt(state, tank); state.shots += 1; state.projectile = { x: tank.x + TANK_W / 2 + direction * 32, y: tank.y - 7, vx: Math.cos(radians) * speed * direction, vy: -Math.sin(radians) * speed, owner: state.activePlayer }; state.phase = 'projectile-flight'; state.announcement = `Player ${state.activePlayer + 1} fired.`; return true; }
    function predictProjectile(projectile, elapsed = 0) { if (!projectile) return null; const seconds = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0; return { ...projectile, x: projectile.x + projectile.vx * seconds, y: projectile.y + projectile.vy * seconds + .5 * GRAVITY * seconds * seconds, vy: projectile.vy + GRAVITY * seconds }; }
    function circleRect(x, y, r, rect) { return x + r >= rect.x && x - r <= rect.x + rect.w && y + r >= rect.y && y - r <= rect.y + rect.h; }
    function resolveShot(state, hit) { const point = state.projectile && Number.isFinite(state.projectile.x) ? { x: state.projectile.x, y: state.projectile.y } : null; state.projectile = null; if (hit && point) { state.impactSerial = (state.impactSerial || 0) + 1; state.lastImpact = { ...point, type: hit.type, index: hit.index, serial: state.impactSerial }; if (hit.type === 'terrain' || hit.type === 'barrier') state.impacts = [...(state.impacts || []), state.lastImpact].slice(-14); } if (hit?.type === 'tank') { state.hits += 1; const target = state.tanks[hit.index]; target.health = Math.max(0, target.health - DAMAGE); if (!target.health) { state.phase = 'game-over'; state.winner = 1 - hit.index; state.announcement = `Player ${state.winner + 1} wins!`; return hit; } } state.activePlayer = 1 - state.activePlayer; state.phase = 'aiming'; state.announcement = hit?.type === 'tank' ? `Direct hit! Player ${state.activePlayer + 1}'s turn.` : `Shot ended. Player ${state.activePlayer + 1}'s turn.`; return hit; }
    function collisionAt(state, x, y) { if (circleRect(x, y, PROJECTILE_R, state.arena.barrier)) return { type: 'barrier' }; for (let index = 0; index < state.tanks.length; index += 1) { const tank = state.tanks[index]; if (circleRect(x, y, PROJECTILE_R, { x: tank.x, y: tank.y, w: TANK_W, h: TANK_H })) return { type: 'tank', index }; } if (y + PROJECTILE_R >= terrainHeightAt(state.arena, x)) return { type: 'terrain' }; if (x + PROJECTILE_R < 0 || x - PROJECTILE_R > WIDTH || y + PROJECTILE_R < 0 || y - PROJECTILE_R > HEIGHT) return { type: 'out-of-bounds' }; return null; }
    function stepPhysics(state, dt = 1 / 120) { if (state.phase !== 'projectile-flight' || !state.projectile || !Number.isFinite(dt) || dt <= 0) return null; const projectile = state.projectile, durationSteps = Math.ceil(dt / (1 / 120)), distanceSteps = Math.ceil(Math.max(Math.abs(projectile.vx * dt), Math.abs(projectile.vy * dt + .5 * GRAVITY * dt * dt)) / 3), steps = Math.max(1, durationSteps, distanceSteps), step = dt / steps; for (let index = 0; index < steps; index += 1) { const dx = projectile.vx * step, dy = projectile.vy * step + .5 * GRAVITY * step * step, hit = collisionAt(state, projectile.x + dx, projectile.y + dy); projectile.x += dx; projectile.y += dy; projectile.vy += GRAVITY * step; if (hit) return resolveShot(state, hit); } return null; }
    function resetMatch(state, seed) { const fresh = createInitialState(seed); Object.keys(state).forEach(key => delete state[key]); Object.assign(state, fresh); beginTurn(state, 0); return state; }
    function snapshot(state) { return { phase: state.phase, activePlayer: state.activePlayer, arena: { seed: state.arena.seed, terrain: [...state.arena.terrain], barrier: { ...state.arena.barrier } }, tanks: state.tanks.map(tank => ({ ...tank })), projectile: state.projectile ? { ...state.projectile } : null, winner: state.winner, shots: state.shots, hits: state.hits, impacts: (state.impacts || []).map(impact => ({ ...impact })), impactSerial: state.impactSerial || 0, lastImpact: state.lastImpact ? { ...state.lastImpact } : null, announcement: state.announcement }; }

    return { WIDTH, HEIGHT, GRAVITY, TANK_W, TANK_H, PROJECTILE_R, STARTING_HEALTH, DAMAGE, TERRAIN_STEP, ARENA_LIMITS, seededRandom, generateArena, terrainHeightAt, tankYAt, createInitialState, beginTurn, tankBounds, moveTank, adjustAim, adjustPower, fireProjectile, predictProjectile, collisionAt, stepPhysics, resolveShot, resetMatch, snapshot };
}));
