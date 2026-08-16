(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.BattleTanksCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const WIDTH = 960, HEIGHT = 540, GRAVITY = 210;
    const TANK_W = 58, TANK_H = 30, PROJECTILE_R = 6;
    const STARTING_HEALTH = 100, DAMAGE = 50, TERRAIN_STEP = 8, BARRIER_CELL = 4;
    const DEFAULT_WEAPON = Object.freeze({ baseDamage: DAMAGE, blastRadius: 52, terrainDamage: 22, powerMultiplier: 1, velocityMultiplier: 0 });
    const DEFAULT_BLAST = Object.freeze({ radius: DEFAULT_WEAPON.blastRadius, depth: DEFAULT_WEAPON.terrainDamage });
    const PICKUP_SIZE = 22, INVENTORY_LIMIT = 3, MAX_PICKUPS = 3, SPAWN_EVERY_TURNS = 3;
    // IDs are protocol values: never derive them from labels or array positions.
    const POWER_UP_CATALOG = Object.freeze({
        'health-pack': Object.freeze({ id: 'health-pack', label: 'Health pack', kind: 'consumable', effect: 'heal', amount: 35, consumesTurn: true }),
        shield: Object.freeze({ id: 'shield', label: 'Shield', kind: 'consumable', effect: 'absorb', capacityRange: Object.freeze({ min: 40, max: 60 }), durationRange: Object.freeze({ min: 2, max: 4 }), consumesTurn: true }),
        invisibility: Object.freeze({ id: 'invisibility', label: 'Invisibility', kind: 'consumable', effect: 'invisible', durationTurns: 2, consumesTurn: true }),
        'weapon-heavy-shell': Object.freeze({ id: 'weapon-heavy-shell', label: 'Heavy shell', kind: 'weapon', weapon: Object.freeze({ ...DEFAULT_WEAPON, baseDamage: 68, blastRadius: 46 }), consumesTurn: false }),
        'weapon-wide-blast': Object.freeze({ id: 'weapon-wide-blast', label: 'Wide blast', kind: 'weapon', weapon: Object.freeze({ ...DEFAULT_WEAPON, baseDamage: 42, blastRadius: 76, terrainDamage: 30 }), consumesTurn: false }),
        'damage-boost': Object.freeze({ id: 'damage-boost', label: 'Damage boost', kind: 'modifier', effect: 'damage', multiplier: 1.35, durationTurns: 2, consumesTurn: true }),
        'blast-radius-boost': Object.freeze({ id: 'blast-radius-boost', label: 'Blast boost', kind: 'modifier', effect: 'blastRadius', multiplier: 1.3, durationTurns: 2, consumesTurn: true })
    });
    const PICKUP_IDS = Object.freeze(Object.keys(POWER_UP_CATALOG));
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
    function pickupRandom(state, salt = 0) { return seededRandom((state.arena.seed ^ Math.imul((state.spawnSerial || 0) + 1 + salt, 0x9e3779b1)) >>> 0)(); }
    function pickupBounds(pickup) { return { x: pickup.x - PICKUP_SIZE / 2, y: pickup.y - PICKUP_SIZE, w: PICKUP_SIZE, h: PICKUP_SIZE }; }
    function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
    function isValidPickupPosition(state, x) {
        if (!Number.isFinite(x) || x < PICKUP_SIZE * 2 || x > WIDTH - PICKUP_SIZE * 2) return false;
        const y = terrainHeightAt(state.arena, x), left = terrainHeightAt(state.arena, x - PICKUP_SIZE / 2), right = terrainHeightAt(state.arena, x + PICKUP_SIZE / 2);
        if (Math.max(Math.abs(y - left), Math.abs(y - right)) > 8) return false;
        const bounds = { x: x - PICKUP_SIZE / 2, y: y - PICKUP_SIZE, w: PICKUP_SIZE, h: PICKUP_SIZE };
        if (rectsOverlap(bounds, state.arena.barrier)) return false;
        if (state.tanks.some(tank => rectsOverlap(bounds, { x: tank.x, y: tank.y, w: TANK_W, h: TANK_H }))) return false;
        return !(state.pickups || []).some(item => rectsOverlap(bounds, pickupBounds(item)));
    }
    function spawnPickup(state, requestedId) {
        if (!state?.arena || (state.pickups || []).length >= MAX_PICKUPS) return null;
        const serial = state.spawnSerial || 0, id = POWER_UP_CATALOG[requestedId] ? requestedId : PICKUP_IDS[Math.floor(pickupRandom(state, 91) * PICKUP_IDS.length)];
        for (let attempt = 0; attempt < 64; attempt += 1) {
            const x = Math.round(PICKUP_SIZE * 2 + pickupRandom(state, attempt + 1) * (WIDTH - PICKUP_SIZE * 4));
            if (!isValidPickupPosition(state, x)) continue;
            const pickup = { serial: serial + 1, id, x, y: terrainHeightAt(state.arena, x) };
            state.spawnSerial = serial + 1; state.pickups.push(pickup); return pickup;
        }
        state.spawnSerial = serial + 1; return null;
    }
    function collectPickup(state, player) {
        const tank = state.tanks[player], inventory = state.inventories[player]; if (!tank || !inventory || inventory.length >= INVENTORY_LIMIT) return [];
        const bounds = { x: tank.x, y: tank.y, w: TANK_W, h: TANK_H }, collected = [];
        state.pickups = state.pickups.filter(pickup => { if (inventory.length >= INVENTORY_LIMIT || !rectsOverlap(bounds, pickupBounds(pickup))) return true; inventory.push(pickup.id); collected.push(pickup.id); return false; });
        if (collected.length) state.announcement = `Player ${player + 1} collected ${POWER_UP_CATALOG[collected[0]].label}.`;
        return collected;
    }
    function expireEffects(state, player) {
        state.activeEffects[player] = state.activeEffects[player].filter(effect => {
            if (effect.effect === 'absorb') return effect.remainingCapacity > 0 && effect.remainingTurns > 0;
            if (Number.isFinite(effect.remainingTurns)) return effect.remainingTurns > 0;
            return false;
        });
        return state.activeEffects[player];
    }
    // Durations tick only after the protected player completes a turn. Starting a
    // turn, reconnecting, and projectile animation updates cannot consume them.
    function endTurnEffects(state, player) { state.activeEffects[player].forEach(effect => { if (Number.isFinite(effect.remainingTurns)) effect.remainingTurns -= 1; }); return expireEffects(state, player); }
    const beginTurnEffects = endTurnEffects;
    function matchRandom(state) { const serial = state.effectSerial || 0; state.effectSerial = serial + 1; return seededRandom((state.rngSeed ^ Math.imul(serial + 1, 0x85ebca6b)) >>> 0)(); }
    function rangedInteger(range, random) { return range.min + Math.floor(clamp(Number(random()), 0, .999999999999) * (range.max - range.min + 1)); }
    function activatePowerUp(state, player, itemId, authoritativeRandom = () => matchRandom(state)) {
        if (state.phase !== 'aiming' || state.activePlayer !== player) return null;
        const inventory = state.inventories[player], index = inventory.indexOf(itemId), item = POWER_UP_CATALOG[itemId]; if (index < 0 || !item) return null;
        inventory.splice(index, 1); const tank = state.tanks[player];
        if (item.kind === 'weapon') state.equippedWeapons[player] = item.id;
        else if (item.effect === 'heal') tank.health = Math.min(STARTING_HEALTH, tank.health + item.amount);
        else if (item.effect === 'absorb') state.activeEffects[player].push({ id: item.id, effect: item.effect, remainingTurns: rangedInteger(item.durationRange, authoritativeRandom), remainingCapacity: rangedInteger(item.capacityRange, authoritativeRandom) });
        else state.activeEffects[player].push({ id: item.id, effect: item.effect, multiplier: item.multiplier, remainingTurns: item.durationTurns });
        state.announcement = `Player ${player + 1} activated ${item.label}.`; return { id: item.id, consumesTurn: item.consumesTurn };
    }
    function advancePickupSchedule(state) { state.completedTurns = (state.completedTurns || 0) + 1; if (state.completedTurns <= 18 && state.completedTurns % SPAWN_EVERY_TURNS === 0) return spawnPickup(state); return null; }
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
        const columns = Math.ceil(w / BARRIER_CELL), rows = Math.ceil(h / BARRIER_CELL);
        return { seed: normalizedSeed, terrain, barrier: { x, y: surface - h, w, h, cellSize: BARRIER_CELL, columns, rows, cells: Array(columns * rows).fill(1) } };
    }
    function terrainHeightAt(arena, x) {
        if (!arena?.terrain?.length) return HEIGHT;
        const position = clamp(x, 0, WIDTH) / TERRAIN_STEP, left = Math.floor(position), right = Math.min(arena.terrain.length - 1, left + 1), mix = position - left;
        return arena.terrain[left] * (1 - mix) + arena.terrain[right] * mix;
    }
    function tankYAt(state, tank) { return terrainHeightAt(state.arena, tank.x + TANK_W / 2) - TANK_H; }
    function barrierOccupiedAt(barrier, x, y) {
        if (!barrier?.cells || x < barrier.x || y < barrier.y || x >= barrier.x + barrier.w || y >= barrier.y + barrier.h) return false;
        const column = Math.floor((x - barrier.x) / barrier.cellSize), row = Math.floor((y - barrier.y) / barrier.cellSize);
        return Boolean(barrier.cells[row * barrier.columns + column]);
    }
    function circleBarrier(x, y, radius, barrier) {
        if (!circleRect(x, y, radius, barrier)) return false;
        const size = barrier.cellSize, fromX = clamp(Math.floor((x - radius - barrier.x) / size), 0, barrier.columns - 1), toX = clamp(Math.floor((x + radius - barrier.x) / size), 0, barrier.columns - 1), fromY = clamp(Math.floor((y - radius - barrier.y) / size), 0, barrier.rows - 1), toY = clamp(Math.floor((y + radius - barrier.y) / size), 0, barrier.rows - 1);
        for (let row = fromY; row <= toY; row += 1) for (let column = fromX; column <= toX; column += 1) {
            if (!barrier.cells[row * barrier.columns + column]) continue;
            const cell = { x: barrier.x + column * size, y: barrier.y + row * size, w: Math.min(size, barrier.x + barrier.w - (barrier.x + column * size)), h: Math.min(size, barrier.y + barrier.h - (barrier.y + row * size)) };
            if (circleRect(x, y, radius, cell)) return true;
        }
        return false;
    }
    function settleTanks(state) {
        state.tanks.forEach((tank, index) => { const bounds = tankBounds(state, index); tank.x = clamp(tank.x, bounds.min, bounds.max); tank.y = tankYAt(state, tank); });
    }
    function projectileWeapon(projectile = {}) {
        const supplied = projectile.weapon || projectile.blast || projectile;
        return Object.freeze({
            baseDamage: Math.max(0, Number(supplied.baseDamage ?? DEFAULT_WEAPON.baseDamage)),
            blastRadius: clamp(Number(supplied.blastRadius ?? supplied.radius ?? DEFAULT_WEAPON.blastRadius), 1, Math.max(WIDTH, HEIGHT)),
            terrainDamage: clamp(Number(supplied.terrainDamage ?? supplied.depth ?? DEFAULT_WEAPON.terrainDamage), 0, HEIGHT),
            powerMultiplier: Math.max(0, Number(supplied.powerMultiplier ?? DEFAULT_WEAPON.powerMultiplier)),
            velocityMultiplier: clamp(Number(supplied.velocityMultiplier ?? DEFAULT_WEAPON.velocityMultiplier), 0, 2)
        });
    }
    function distanceToTank(state, point, tank) {
        const dx = Math.max(tank.x - point.x, 0, point.x - (tank.x + TANK_W));
        const dy = Math.max(tank.y - point.y, 0, point.y - (tank.y + TANK_H));
        return Math.hypot(dx, dy);
    }
    function applyDamage(state, tankIndex, amount, source = 'unknown') {
        const tank = state.tanks[tankIndex], attemptedDamage = Math.max(0, Math.round(Number(amount) || 0));
        if (!tank || !attemptedDamage) return { tank: tankIndex, source, attemptedDamage, absorbedDamage: 0, healthDamage: 0 };
        let absorbedDamage = 0;
        for (const shield of state.activeEffects?.[tankIndex] || []) {
            if (shield.effect !== 'absorb' || shield.remainingTurns <= 0 || shield.remainingCapacity <= 0) continue;
            const absorbedByShield = Math.min(shield.remainingCapacity, attemptedDamage - absorbedDamage);
            shield.remainingCapacity -= absorbedByShield;
            absorbedDamage += absorbedByShield;
            if (absorbedDamage === attemptedDamage) break;
        }
        const healthDamage = Math.min(tank.health, attemptedDamage - absorbedDamage);
        tank.health = Math.max(0, tank.health - healthDamage);
        if (state.damageTaken) state.damageTaken[tankIndex] += healthDamage;
        expireEffects(state, tankIndex);
        return { tank: tankIndex, source, attemptedDamage, absorbedDamage, healthDamage };
    }
    function resolveExplosion(state, impact, projectile = {}, legacyType) {
        if (!impact || !Number.isFinite(impact.x) || !Number.isFinite(impact.y)) return null;
        const weapon = projectileWeapon(projectile), radius = weapon.blastRadius, depth = weapon.terrainDamage;
        const speed = Math.hypot(Number(projectile.vx) || 0, Number(projectile.vy) || 0);
        // Velocity bonuses use normalized impact speed, never the aiming-power UI value.
        const speedFactor = clamp(speed / 400, .5, 1.5);
        const maximumDamage = weapon.baseDamage * weapon.powerMultiplier * (1 + weapon.velocityMultiplier * (speedFactor - 1));
        const result = { x: impact.x, y: impact.y, type: impact.type || legacyType || 'terrain', index: impact.index, owner: projectile.owner, weapon: { ...weapon }, impactSpeed: Math.round(speed * 10) / 10, affected: [], totalDamage: 0 };
        state.tanks.forEach((tank, index) => {
            const distance = distanceToTank(state, impact, tank);
            if (distance >= radius) return;
            // Linear splash falloff: full damage in the inner 20%, then a straight taper to zero at the radius.
            const falloff = distance <= radius * .2 ? 1 : (radius - distance) / (radius * .8);
            const attemptedDamage = Math.max(0, Math.round(maximumDamage * clamp(falloff, 0, 1)));
            if (!attemptedDamage) return;
            const damage = applyDamage(state, index, attemptedDamage, { type: 'explosion', owner: projectile.owner, impact: { x: impact.x, y: impact.y } });
            result.affected.push({ ...damage, distance: Math.round(distance * 10) / 10 });
            result.totalDamage += damage.healthDamage;
        });
        const point = impact, hitType = result.type;
        if (hitType === 'terrain') {
            const first = clamp(Math.ceil((point.x - radius) / TERRAIN_STEP), 0, state.arena.terrain.length - 1), last = clamp(Math.floor((point.x + radius) / TERRAIN_STEP), 0, state.arena.terrain.length - 1);
            for (let index = first; index <= last; index += 1) { const distance = Math.abs(index * TERRAIN_STEP - point.x), cut = depth * Math.sqrt(Math.max(0, 1 - (distance * distance) / (radius * radius))); state.arena.terrain[index] = Math.round(clamp(Math.max(state.arena.terrain[index], point.y + cut), 0, HEIGHT) * 10) / 10; }
        } else if (hitType === 'barrier') {
            const barrier = state.arena.barrier, size = barrier.cellSize, firstColumn = clamp(Math.floor((point.x - radius - barrier.x) / size), 0, barrier.columns - 1), lastColumn = clamp(Math.floor((point.x + radius - barrier.x) / size), 0, barrier.columns - 1), firstRow = clamp(Math.floor((point.y - radius - barrier.y) / size), 0, barrier.rows - 1), lastRow = clamp(Math.floor((point.y + radius - barrier.y) / size), 0, barrier.rows - 1);
            for (let row = firstRow; row <= lastRow; row += 1) for (let column = firstColumn; column <= lastColumn; column += 1) { const cx = barrier.x + (column + .5) * size, cy = barrier.y + (row + .5) * size; if ((cx - point.x) ** 2 + (cy - point.y) ** 2 <= radius ** 2) barrier.cells[row * barrier.columns + column] = 0; }
        }
        if (hitType === 'terrain' || hitType === 'barrier') settleTanks(state);
        return result;
    }
    function tankBounds(state, player) { const barrier = state.arena.barrier; return player === 0 ? { min: 0, max: barrier.x - TANK_W } : { min: barrier.x + barrier.w, max: WIDTH - TANK_W }; }
    function createInitialState(seed) {
        const arena = generateArena(seed), tanks = [
            { x: 115, angle: 45, power: 60, health: STARTING_HEALTH },
            { x: WIDTH - 115 - TANK_W, angle: 45, power: 60, health: STARTING_HEALTH }
        ];
        const state = { phase: 'setup', activePlayer: 0, arena, rngSeed: arena.seed, effectSerial: 0, tanks, projectile: null, winner: null, shots: 0, hits: 0, damageTaken: [0, 0], impacts: [], impactSerial: 0, lastImpact: null, pickups: [], inventories: [[], []], equippedWeapons: [null, null], activeEffects: [[], []], spawnSerial: 0, completedTurns: 0, startedAt: Date.now(), resultSubmitted: false, announcement: 'Preparing the arena.' };
        tanks.forEach(tank => { tank.y = tankYAt(state, tank); });
        return state;
    }
    function beginTurn(state, player = state.activePlayer) { if (state.phase === 'game-over') return false; state.activePlayer = player; state.phase = 'aiming'; state.projectile = null; state.announcement = `Player ${player + 1}: adjust your shot.`; return true; }
    function moveTank(state, direction, amount = 8) { if (state.phase !== 'aiming') return false; const tank = state.tanks[state.activePlayer], bounds = tankBounds(state, state.activePlayer); tank.x = clamp(tank.x + (direction === 'forward' ? (state.activePlayer ? -amount : amount) : (state.activePlayer ? amount : -amount)), bounds.min, bounds.max); tank.y = tankYAt(state, tank); collectPickup(state, state.activePlayer); return true; }
    function adjustAim(state, delta) { if (state.phase !== 'aiming') return false; const tank = state.tanks[state.activePlayer]; tank.angle = clamp(tank.angle + delta, 10, 80); return true; }
    function adjustPower(state, delta) { if (state.phase !== 'aiming') return false; const tank = state.tanks[state.activePlayer]; tank.power = clamp(tank.power + delta, 20, 100); return true; }
    function fireProjectile(state, weapon) { if (state.phase !== 'aiming') return false; const tank = state.tanks[state.activePlayer], direction = state.activePlayer ? -1 : 1, radians = tank.angle * Math.PI / 180, speed = 170 + tank.power * 3.2, equipped = POWER_UP_CATALOG[state.equippedWeapons[state.activePlayer]]?.weapon, effects = state.activeEffects[state.activePlayer], selected = { ...(weapon || equipped || DEFAULT_WEAPON) }; effects.forEach(effect => { if (effect.effect === 'damage') selected.baseDamage = (selected.baseDamage || DAMAGE) * effect.multiplier; if (effect.effect === 'blastRadius') selected.blastRadius = (selected.blastRadius || DEFAULT_WEAPON.blastRadius) * effect.multiplier; }); tank.y = tankYAt(state, tank); state.shots += 1; state.projectile = { x: tank.x + TANK_W / 2 + direction * 32, y: tank.y - 7, vx: Math.cos(radians) * speed * direction, vy: -Math.sin(radians) * speed, owner: state.activePlayer, weapon: projectileWeapon({ weapon: selected }) }; Object.freeze(state.projectile.weapon); state.phase = 'projectile-flight'; state.announcement = `Player ${state.activePlayer + 1} fired.`; return true; }
    function predictProjectile(projectile, elapsed = 0) { if (!projectile) return null; const seconds = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0; return { ...projectile, x: projectile.x + projectile.vx * seconds, y: projectile.y + projectile.vy * seconds + .5 * GRAVITY * seconds * seconds, vy: projectile.vy + GRAVITY * seconds }; }
    function circleRect(x, y, r, rect) { return x + r >= rect.x && x - r <= rect.x + rect.w && y + r >= rect.y && y - r <= rect.y + rect.h; }
    function resolveShot(state, hit) { const completedPlayer = state.activePlayer, projectile = state.projectile, point = projectile && Number.isFinite(projectile.x) ? { x: projectile.x, y: projectile.y, type: hit?.type, index: hit?.index } : null; state.projectile = null; if (hit && point) { state.impactSerial = (state.impactSerial || 0) + 1; const explosion = resolveExplosion(state, point, projectile); state.lastImpact = { ...explosion, serial: state.impactSerial }; state.impacts = [...(state.impacts || []), state.lastImpact].slice(-14); if (explosion.affected.some(item => item.healthDamage > 0)) state.hits += 1; } endTurnEffects(state, completedPlayer); const destroyed = state.tanks.map((tank, index) => tank.health <= 0 ? index : -1).filter(index => index >= 0); if (destroyed.length) { state.phase = 'game-over'; if (destroyed.length === state.tanks.length) { state.winner = null; state.draw = true; state.announcement = 'Draw! Both tanks were destroyed.'; } else { state.winner = 1 - destroyed[0]; state.draw = false; state.announcement = `Player ${state.winner + 1} wins!`; } return hit; } advancePickupSchedule(state); state.activePlayer = 1 - state.activePlayer; state.phase = 'aiming'; const damage = state.lastImpact?.totalDamage || 0; state.announcement = damage ? `${damage} splash damage. Player ${state.activePlayer + 1}'s turn.` : `Shot ended. Player ${state.activePlayer + 1}'s turn.`; return hit; }
    function collisionAt(state, x, y) { if (circleBarrier(x, y, PROJECTILE_R, state.arena.barrier)) return { type: 'barrier' }; for (let index = 0; index < state.tanks.length; index += 1) { const tank = state.tanks[index]; if (circleRect(x, y, PROJECTILE_R, { x: tank.x, y: tank.y, w: TANK_W, h: TANK_H })) return { type: 'tank', index }; } if (y + PROJECTILE_R >= terrainHeightAt(state.arena, x)) return { type: 'terrain' }; if (x + PROJECTILE_R < 0 || x - PROJECTILE_R > WIDTH || y + PROJECTILE_R < 0 || y - PROJECTILE_R > HEIGHT) return { type: 'out-of-bounds' }; return null; }
    function stepPhysics(state, dt = 1 / 120) { if (state.phase !== 'projectile-flight' || !state.projectile || !Number.isFinite(dt) || dt <= 0) return null; const projectile = state.projectile, durationSteps = Math.ceil(dt / (1 / 120)), distanceSteps = Math.ceil(Math.max(Math.abs(projectile.vx * dt), Math.abs(projectile.vy * dt + .5 * GRAVITY * dt * dt)) / 3), steps = Math.max(1, durationSteps, distanceSteps), step = dt / steps; for (let index = 0; index < steps; index += 1) { const dx = projectile.vx * step, dy = projectile.vy * step + .5 * GRAVITY * step * step, hit = collisionAt(state, projectile.x + dx, projectile.y + dy); projectile.x += dx; projectile.y += dy; projectile.vy += GRAVITY * step; if (hit) return resolveShot(state, hit); } return null; }
    function resetMatch(state, seed) { const fresh = createInitialState(seed); Object.keys(state).forEach(key => delete state[key]); Object.assign(state, fresh); beginTurn(state, 0); return state; }
    function snapshot(state) { return { phase: state.phase, activePlayer: state.activePlayer, arena: { seed: state.arena.seed, terrain: [...state.arena.terrain], barrier: { ...state.arena.barrier, cells: [...state.arena.barrier.cells] } }, tanks: state.tanks.map(tank => ({ ...tank })), projectile: state.projectile ? { ...state.projectile, weapon: state.projectile.weapon ? { ...state.projectile.weapon } : undefined } : null, winner: state.winner, draw: Boolean(state.draw), shots: state.shots, hits: state.hits, damageTaken: [...(state.damageTaken || [0, 0])], impacts: (state.impacts || []).map(impact => ({ ...impact, affected: (impact.affected || []).map(item => ({ ...item })) })), impactSerial: state.impactSerial || 0, lastImpact: state.lastImpact ? { ...state.lastImpact, affected: (state.lastImpact.affected || []).map(item => ({ ...item })) } : null, pickups: state.pickups.map(item => ({ ...item })), inventories: state.inventories.map(items => [...items]), equippedWeapons: [...state.equippedWeapons], rngSeed: state.rngSeed, effectSerial: state.effectSerial, activeEffects: state.activeEffects.map(effects => effects.map(effect => ({ ...effect }))), spawnSerial: state.spawnSerial, completedTurns: state.completedTurns, announcement: state.announcement }; }

    return { WIDTH, HEIGHT, GRAVITY, TANK_W, TANK_H, PROJECTILE_R, STARTING_HEALTH, DAMAGE, TERRAIN_STEP, BARRIER_CELL, DEFAULT_BLAST, DEFAULT_WEAPON, POWER_UP_CATALOG, PICKUP_IDS, PICKUP_SIZE, INVENTORY_LIMIT, MAX_PICKUPS, SPAWN_EVERY_TURNS, ARENA_LIMITS, seededRandom, generateArena, terrainHeightAt, tankYAt, barrierOccupiedAt, settleTanks, resolveExplosion, isValidPickupPosition, spawnPickup, collectPickup, activatePowerUp, applyDamage, beginTurnEffects, endTurnEffects, expireEffects, advancePickupSchedule, createInitialState, beginTurn, tankBounds, moveTank, adjustAim, adjustPower, fireProjectile, predictProjectile, collisionAt, stepPhysics, resolveShot, resetMatch, snapshot };
}));
