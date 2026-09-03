(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.BattleTanksCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const STATE_VERSION = 3;
    // CSS scales this larger logical world to the available screen, retaining
    // considerably more travel space and detail in full screen mode.
    const WIDTH = 1440, HEIGHT = 810, GRAVITY = 210;
    const TANK_W = 58, TANK_H = 30, PROJECTILE_R = 6;
    const STARTING_HEALTH = 100, DAMAGE = 50, TERRAIN_STEP = 8, BARRIER_CELL = 4;
    // Weapon ids are protocol values.  Labels are deliberately presentation-only.
    const WEAPON_REGISTRY = Object.freeze({
        shell: Object.freeze({ id: 'shell', label: 'Standard shell', strategy: 'ballistic', launch: Object.freeze({ baseSpeed: 170, powerSpeed: 3.2, mass: 1 }), baseDamage: DAMAGE, blastRadius: 52, terrainDamage: 22, powerMultiplier: 1, velocityMultiplier: 0, ammo: Object.freeze({ unlimited: true, perPickup: 0 }) }),
        'wide-blast': Object.freeze({ id: 'wide-blast', label: 'Wide blast shell', strategy: 'ballistic', launch: Object.freeze({ baseSpeed: 165, powerSpeed: 3, mass: 1.1 }), baseDamage: 42, blastRadius: 130, terrainDamage: 34, powerMultiplier: 1, velocityMultiplier: 0, ammo: Object.freeze({ unlimited: false, perPickup: 2 }) }),
        'heavy-shell': Object.freeze({ id: 'heavy-shell', label: 'Heavy shell', strategy: 'ballistic', launch: Object.freeze({ baseSpeed: 145, powerSpeed: 2.35, mass: 2.2, maximumPower: 100 }), baseDamage: 72, blastRadius: 70, terrainDamage: 38, powerMultiplier: 1, velocityMultiplier: 0, ammo: Object.freeze({ unlimited: false, perPickup: 2 }) }),
        homing: Object.freeze({ id: 'homing', label: 'Homing missile', strategy: 'homing', launch: Object.freeze({ baseSpeed: 135, powerSpeed: 2.25, mass: 1.15 }), baseDamage: 46, blastRadius: 58, terrainDamage: 25, powerMultiplier: 1, velocityMultiplier: 0, ammo: Object.freeze({ unlimited: false, perPickup: 2 }), homing: Object.freeze({ acquisitionRange: 1050, targetInvisible: false, lockDelay: .18, turnRate: Math.PI * .72, acceleration: 75, unavailable: 'ballistic' }) }),
        laser: Object.freeze({ id: 'laser', label: 'Ricochet laser', strategy: 'ray', launch: Object.freeze({ baseSpeed: 0, powerSpeed: 0, mass: 0 }), baseDamage: 38, blastRadius: 1, terrainDamage: 0, powerMultiplier: 1, velocityMultiplier: 0, ammo: Object.freeze({ unlimited: false, perPickup: 2 }), ray: Object.freeze({ maxBounces: 5, maxDistance: 2700, energyRetention: .68, minimumEnergy: .12 }) })
    });
    const DEFAULT_WEAPON = WEAPON_REGISTRY.shell;
    const DEFAULT_BLAST = Object.freeze({ radius: DEFAULT_WEAPON.blastRadius, depth: DEFAULT_WEAPON.terrainDamage });
    const PICKUP_SIZE = 48, INVENTORY_LIMIT = 3, MAX_PICKUPS = 3, SPAWN_EVERY_TURNS = 3;
    // IDs are protocol values: never derive them from labels or array positions.
    const POWER_UP_CATALOG = Object.freeze({
        'health-pack': Object.freeze({ id: 'health-pack', label: 'Health pack', kind: 'consumable', effect: 'heal', amount: 35, consumesTurn: false }),
        shield: Object.freeze({ id: 'shield', label: 'Shield', kind: 'consumable', effect: 'absorb', capacityRange: Object.freeze({ min: 40, max: 60 }), durationRange: Object.freeze({ min: 2, max: 4 }), consumesTurn: false }),
        invisibility: Object.freeze({ id: 'invisibility', label: 'Invisibility', kind: 'consumable', effect: 'invisible', durationRange: Object.freeze({ min: 1, max: 3 }), consumesTurn: false, onlineOnly: true }),
        'weapon-heavy-shell': Object.freeze({ id: 'weapon-heavy-shell', label: 'Heavy shell ammo', kind: 'weapon', weaponId: 'heavy-shell', weapon: WEAPON_REGISTRY['heavy-shell'], consumesTurn: false }),
        'weapon-homing': Object.freeze({ id: 'weapon-homing', label: 'Homing missile ammo', kind: 'weapon', weaponId: 'homing', weapon: WEAPON_REGISTRY.homing, consumesTurn: false }),
        'weapon-laser': Object.freeze({ id: 'weapon-laser', label: 'Ricochet laser ammo', kind: 'weapon', weaponId: 'laser', weapon: WEAPON_REGISTRY.laser, consumesTurn: false }),
        'weapon-wide-blast': Object.freeze({ id: 'weapon-wide-blast', label: 'Wide blast ammo', kind: 'weapon', weaponId: 'wide-blast', weapon: WEAPON_REGISTRY['wide-blast'], consumesTurn: false }),
        'damage-boost': Object.freeze({ id: 'damage-boost', label: 'Damage boost', kind: 'modifier', effect: 'damage', multiplier: 1.35, durationTurns: 2, consumesTurn: false }),
        'blast-radius-boost': Object.freeze({ id: 'blast-radius-boost', label: 'Blast boost', kind: 'modifier', effect: 'blastRadius', multiplier: 1.3, durationTurns: 2, consumesTurn: false })
    });
    const PICKUP_IDS = Object.freeze(Object.keys(POWER_UP_CATALOG));
    const LOCAL_PICKUP_IDS = Object.freeze(PICKUP_IDS.filter(id => !POWER_UP_CATALOG[id].onlineOnly));
    const ACQUISITION_HISTORY_LIMIT = 8;
    const POWER_UP_PRESENTATION = Object.freeze({
        'health-pack': { description: 'restores up to 35 health', iconKey: 'health', rarity: 'common', theme: 'support' }, shield: { description: 'absorbs incoming damage', iconKey: 'shield', rarity: 'rare', theme: 'defence' }, invisibility: { description: 'conceals movement and firing information', iconKey: 'hidden', rarity: 'rare', theme: 'stealth' },
        'weapon-heavy-shell': { description: 'increased blast and terrain damage', iconKey: 'heavy-shell', rarity: 'rare', theme: 'weapon' }, 'weapon-homing': { description: 'adds homing missile ammunition', iconKey: 'homing', rarity: 'rare', theme: 'weapon' }, 'weapon-laser': { description: 'adds ricochet laser ammunition', iconKey: 'laser', rarity: 'epic', theme: 'weapon' }, 'weapon-wide-blast': { description: 'adds wide blast ammunition', iconKey: 'wide-blast', rarity: 'uncommon', theme: 'weapon' },
        'damage-boost': { description: 'increases damage for two turns', iconKey: 'damage', rarity: 'uncommon', theme: 'boost' }, 'blast-radius-boost': { description: 'increases blast radius for two turns', iconKey: 'blast', rarity: 'uncommon', theme: 'boost' }
    });
    // Arena guarantees used by both generation and tests/UI: terrain stays in
    // this vertical band and the centre wall varies without trapping either tank.
    const ARENA_LIMITS = Object.freeze({ terrainMin: 650, terrainMax: 750, barrierWidthMin: 68, barrierWidthMax: 108, barrierHeightMin: 190, barrierHeightMax: 285, sideSpaceMin: 570 });
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
        const availableIds = state.onlineMode ? PICKUP_IDS : LOCAL_PICKUP_IDS, requested = POWER_UP_CATALOG[requestedId];
        if (requested?.onlineOnly && !state.onlineMode) return null;
        const serial = state.spawnSerial || 0, id = requested ? requestedId : availableIds[Math.floor(pickupRandom(state, 91) * availableIds.length)];
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
        state.pickups = state.pickups.filter(pickup => { if (inventory.length >= INVENTORY_LIMIT || !rectsOverlap(bounds, pickupBounds(pickup))) return true; inventory.push(pickup.id); collected.push(pickup.id); emitAcquisition(state, player, pickup.id); return false; });
        if (collected.length) { if (state.statistics) { state.statistics.powerUps[player] += collected.length; state.statistics.powerUpsAcquired[player] += collected.length; } state.announcement = `Player ${player + 1} collected ${POWER_UP_CATALOG[collected[0]].label}.`; }
        return collected;
    }
    function emitAcquisition(state, player, powerUpType) {
        const item = POWER_UP_CATALOG[powerUpType], presentation = POWER_UP_PRESENTATION[powerUpType]; if (!item || !presentation) return null;
        const generatedValues = {};
        if (item.capacityRange) generatedValues.capacity = rangedInteger(item.capacityRange, () => matchRandom(state));
        if (item.durationRange) generatedValues.durationTurns = rangedInteger(item.durationRange, () => matchRandom(state)); else if (item.durationTurns) generatedValues.durationTurns = item.durationTurns;
        if (item.kind === 'weapon') generatedValues.ammunition = item.weapon.ammo.perPickup;
        const event = { eventId: (state.acquisitionEventId || 0) + 1, player, powerUpType, displayName: item.label, effectDescription: presentation.description, iconKey: presentation.iconKey, rarity: presentation.rarity, theme: presentation.theme, generatedValues };
        state.acquisitionEventId = event.eventId; state.acquisitionEvents = [...(state.acquisitionEvents || []), event].slice(-ACQUISITION_HISTORY_LIMIT); (state.acquiredValues[player] ||= []).push({ powerUpType, ...generatedValues }); return event;
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
        inventory.splice(index, 1); if (state.statistics) { state.statistics.powerUpsUsed[player] += 1; state.statistics.powerUpTypesUsed[player].add(itemId); if (itemId === 'invisibility') state.statistics.invisibilityActivations[player] += 1; } const tank = state.tanks[player], generatedIndex = (state.acquiredValues?.[player] || []).findIndex(value => value.powerUpType === itemId), generated = generatedIndex < 0 ? null : state.acquiredValues[player].splice(generatedIndex, 1)[0];
        if (item.kind === 'weapon') {
            const weaponId = item.weaponId || 'shell', rule = WEAPON_REGISTRY[weaponId].ammo;
            state.weaponAmmo[player][weaponId] = (state.weaponAmmo[player][weaponId] || 0) + rule.perPickup;
            state.equippedWeapons[player] = weaponId;
        }
        else if (item.effect === 'heal') { const before = tank.health; tank.health = Math.min(STARTING_HEALTH, tank.health + item.amount); if (state.statistics) { state.statistics.healing[player] += tank.health - before; state.statistics.healthRestored[player] += tank.health - before; } }
        else if (item.effect === 'absorb') state.activeEffects[player].push({ id: item.id, effect: item.effect, remainingTurns: generated?.durationTurns ?? rangedInteger(item.durationRange, authoritativeRandom), remainingCapacity: generated?.capacity ?? rangedInteger(item.capacityRange, authoritativeRandom) });
        else state.activeEffects[player].push({ id: item.id, effect: item.effect, multiplier: item.multiplier, remainingTurns: generated?.durationTurns ?? (item.durationRange ? rangedInteger(item.durationRange, authoritativeRandom) : item.durationTurns) });
        state.announcement = `Player ${player + 1} activated ${item.label}.`; return { id: item.id, consumesTurn: item.consumesTurn };
    }
    function advancePickupSchedule(state) { state.completedTurns = (state.completedTurns || 0) + 1; if (state.completedTurns % SPAWN_EVERY_TURNS === 0) return spawnPickup(state); return null; }
    function generateArena(seed = Date.now()) {
        const normalizedSeed = seedValue(seed), random = seededRandom(normalizedSeed), count = WIDTH / TERRAIN_STEP + 1;
        let terrain = Array.from({ length: count }, (_, index) => {
            const x = index * TERRAIN_STEP;
            return 700 + Math.sin(x / 118 + random() * 1.4) * 28 + (random() - .5) * 34;
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
        flattenPad(72, 328, 80); flattenPad(WIDTH - 328, WIDTH - 72, 80);
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
            velocityMultiplier: clamp(Number(supplied.velocityMultiplier ?? DEFAULT_WEAPON.velocityMultiplier), 0, 2),
            id: WEAPON_REGISTRY[supplied.id]?.id || 'shell', strategy: supplied.strategy || 'ballistic'
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
        if (state.statistics) state.statistics.shieldDamageAbsorbed[tankIndex] += absorbedDamage;
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
        if (Number.isInteger(projectile.owner) && state.statistics?.splashDamage) state.statistics.splashDamage[projectile.owner] += result.totalDamage;
        if (Number.isInteger(projectile.owner) && state.statistics) { const opponentDamage = result.affected.find(item => item.tank !== projectile.owner)?.healthDamage || 0; if (opponentDamage > 0 && (weapon.id !== 'shell' || weapon.baseDamage !== WEAPON_REGISTRY.shell.baseDamage || weapon.blastRadius !== WEAPON_REGISTRY.shell.blastRadius)) state.statistics.poweredHits[projectile.owner] += 1; if (opponentDamage > 0 && weapon.id === 'homing') state.statistics.homingHits[projectile.owner] += 1; if (weapon.id === 'heavy-shell') state.statistics.heavyProjectileMaxDamage[projectile.owner] = Math.max(state.statistics.heavyProjectileMaxDamage[projectile.owner], opponentDamage); }
        if (hitType === 'terrain' || hitType === 'barrier') settleTanks(state);
        return result;
    }
    function tankBounds(state, player) { const barrier = state.arena.barrier; return player === 0 ? { min: 0, max: barrier.x - TANK_W } : { min: barrier.x + barrier.w, max: WIDTH - TANK_W }; }
    function createInitialState(seed) {
        const arena = generateArena(seed), tanks = [
            { x: 115, angle: 45, power: 60, health: STARTING_HEALTH },
            { x: WIDTH - 115 - TANK_W, angle: 45, power: 60, health: STARTING_HEALTH }
        ];
        const state = { phase: 'setup', matchId: 0, activePlayer: 0, arena, rngSeed: arena.seed, effectSerial: 0, acquisitionEventId: 0, acquisitionEvents: [], acquiredValues: [[], []], tanks, projectile: null, laserPath: null, winner: null, shots: 0, hits: 0, damageTaken: [0, 0], statistics: { weapons: [{}, {}], splashDamage: [0, 0], healing: [0, 0], powerUps: [0, 0], powerUpsAcquired: [0, 0], powerUpsUsed: [0, 0], powerUpTypesUsed: [new Set(), new Set()], shieldDamageAbsorbed: [0, 0], healthRestored: [0, 0], invisibilityActivations: [0, 0], laserRicochetHits: [0, 0], laserSelfDamage: [0, 0], homingHits: [0, 0], heavyProjectileMaxDamage: [0, 0], poweredHits: [0, 0] }, impacts: [], impactSerial: 0, lastImpact: null, pickups: [], inventories: [[], []], equippedWeapons: [null, null], weaponAmmo: [{ shell: null, 'wide-blast': 0, 'heavy-shell': 0, homing: 0, laser: 0 }, { shell: null, 'wide-blast': 0, 'heavy-shell': 0, homing: 0, laser: 0 }], activeEffects: [[], []], spawnSerial: 0, completedTurns: 0, startedAt: Date.now(), resultSubmitted: false, announcement: 'Preparing the arena.' };
        tanks.forEach(tank => { tank.y = tankYAt(state, tank); });
        return state;
    }
    function beginTurn(state, player = state.activePlayer) { if (state.phase === 'game-over') return false; state.activePlayer = player; state.phase = 'aiming'; state.projectile = null; state.announcement = `Player ${player + 1}: adjust your shot.`; return true; }
    function selectWeapon(state, player, weaponId) { const weapon = WEAPON_REGISTRY[weaponId]; if (state.phase !== 'aiming' || player !== state.activePlayer || !weapon) return false; if (!weapon.ammo.unlimited && !(state.weaponAmmo?.[player]?.[weaponId] > 0)) return false; state.equippedWeapons[player] = weaponId === 'shell' ? null : weaponId; return true; }
    function moveTank(state, direction, amount = 8) { if (state.phase !== 'aiming') return false; const tank = state.tanks[state.activePlayer], bounds = tankBounds(state, state.activePlayer); tank.x = clamp(tank.x + (direction === 'forward' ? (state.activePlayer ? -amount : amount) : (state.activePlayer ? amount : -amount)), bounds.min, bounds.max); tank.y = tankYAt(state, tank); collectPickup(state, state.activePlayer); return true; }
    function adjustAim(state, delta) { if (state.phase !== 'aiming') return false; const tank = state.tanks[state.activePlayer]; tank.angle = clamp(tank.angle + delta, 10, 80); return true; }
    function adjustPower(state, delta) { if (state.phase !== 'aiming') return false; const tank = state.tanks[state.activePlayer]; tank.power = clamp(tank.power + delta, 20, 100); return true; }
    function fireProjectile(state, requestedId) { if (state.phase !== 'aiming') return false; const tank = state.tanks[state.activePlayer], direction = state.activePlayer ? -1 : 1, radians = tank.angle * Math.PI / 180, id = typeof requestedId === 'string' ? requestedId : state.equippedWeapons[state.activePlayer] || 'shell', definition = WEAPON_REGISTRY[id]; if (!definition || (!definition.ammo.unlimited && !(state.weaponAmmo[state.activePlayer][id] > 0))) return false; if (state.statistics?.weapons?.[state.activePlayer]) state.statistics.weapons[state.activePlayer][id] = (state.statistics.weapons[state.activePlayer][id] || 0) + 1; const effects = state.activeEffects[state.activePlayer], selected = { ...definition }; effects.forEach(effect => { if (effect.effect === 'damage') selected.baseDamage *= effect.multiplier; if (effect.effect === 'blastRadius') selected.blastRadius *= effect.multiplier; }); tank.y = tankYAt(state, tank); state.shots += 1; if (!definition.ammo.unlimited) { state.weaponAmmo[state.activePlayer][id] -= 1; if (!state.weaponAmmo[state.activePlayer][id]) state.equippedWeapons[state.activePlayer] = 'shell'; } const speed = definition.strategy === 'ray' ? 1 : definition.launch.baseSpeed + tank.power * definition.launch.powerSpeed; state.laserPath = null; state.projectile = { x: tank.x + TANK_W / 2 + direction * 32, y: tank.y - 7, vx: Math.cos(radians) * speed * direction, vy: -Math.sin(radians) * speed, owner: state.activePlayer, weaponId: id, strategy: definition.strategy, age: 0, target: null, weapon: projectileWeapon({ weapon: selected }) }; Object.freeze(state.projectile.weapon); state.phase = 'projectile-flight'; state.announcement = `Player ${state.activePlayer + 1} fired ${definition.label}.`; if (definition.strategy === 'ray') resolveLaser(state, state.projectile, definition); return true; }
    function predictProjectile(projectile, elapsed = 0) { if (!projectile) return null; const seconds = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0; return { ...projectile, x: projectile.x + projectile.vx * seconds, y: projectile.y + projectile.vy * seconds + .5 * GRAVITY * seconds * seconds, vy: projectile.vy + GRAVITY * seconds }; }
    function circleRect(x, y, r, rect) { return x + r >= rect.x && x - r <= rect.x + rect.w && y + r >= rect.y && y - r <= rect.y + rect.h; }
    function resolveShot(state, hit) { const completedPlayer = state.activePlayer, projectile = state.projectile, point = projectile && Number.isFinite(projectile.x) ? { x: projectile.x, y: projectile.y, type: hit?.type, index: hit?.index } : null; let currentImpact = null; state.projectile = null; if (hit && point) { state.impactSerial = (state.impactSerial || 0) + 1; const explosion = resolveExplosion(state, point, projectile); currentImpact = state.lastImpact = { ...explosion, serial: state.impactSerial }; state.impacts = [...(state.impacts || []), state.lastImpact].slice(-14); if (explosion.affected.some(item => item.healthDamage > 0)) state.hits += 1; } endTurnEffects(state, completedPlayer); const destroyed = state.tanks.map((tank, index) => tank.health <= 0 ? index : -1).filter(index => index >= 0); if (destroyed.length) { state.phase = 'game-over'; if (destroyed.length === state.tanks.length) { state.winner = null; state.draw = true; state.announcement = 'Draw! Both tanks were destroyed.'; } else { state.winner = 1 - destroyed[0]; state.draw = false; state.announcement = `Player ${state.winner + 1} wins!`; } return hit; } advancePickupSchedule(state); state.activePlayer = 1 - state.activePlayer; state.phase = 'aiming'; const damage = currentImpact?.totalDamage || 0; state.announcement = damage ? `${damage} splash damage. Player ${state.activePlayer + 1}'s turn.` : `Shot ended. Player ${state.activePlayer + 1}'s turn.`; return hit; }
    function collisionAt(state, x, y) { if (circleBarrier(x, y, PROJECTILE_R, state.arena.barrier)) return { type: 'barrier' }; for (let index = 0; index < state.tanks.length; index += 1) { const tank = state.tanks[index]; if (circleRect(x, y, PROJECTILE_R, { x: tank.x, y: tank.y, w: TANK_W, h: TANK_H })) return { type: 'tank', index }; } if (y + PROJECTILE_R >= terrainHeightAt(state.arena, x)) return { type: 'terrain' }; if (x + PROJECTILE_R < 0 || x - PROJECTILE_R > WIDTH || y + PROJECTILE_R < 0 || y - PROJECTILE_R > HEIGHT) return { type: 'out-of-bounds' }; return null; }
    function rayBox(origin, direction, rect) { let near = -Infinity, far = Infinity, normal = null; for (const axis of ['x', 'y']) { const low = rect[axis], high = low + (axis === 'x' ? rect.w : rect.h), value = origin[axis], velocity = direction[axis]; if (Math.abs(velocity) < 1e-9) { if (value < low || value > high) return null; continue; } let a = (low - value) / velocity, b = (high - value) / velocity, n = axis === 'x' ? { x: -Math.sign(velocity), y: 0 } : { x: 0, y: -Math.sign(velocity) }; if (a > b) { [a, b] = [b, a]; n = { x: -n.x, y: -n.y }; } if (a > near) { near = a; normal = n; } far = Math.min(far, b); if (near > far) return null; } return far > 1e-4 && near > 1e-4 ? { distance: near, normal } : null; }
    function nearestLaserHit(state, origin, direction, limit) {
        const candidates = [];
        state.tanks.forEach((tank, index) => { const hit = rayBox(origin, direction, { x: tank.x, y: tank.y, w: TANK_W, h: TANK_H }); if (hit) candidates.push({ ...hit, type: 'tank', index }); });
        const barrier = state.arena.barrier, size = barrier.cellSize; for (let row = 0; row < barrier.rows; row += 1) for (let column = 0; column < barrier.columns; column += 1) { if (!barrier.cells[row * barrier.columns + column]) continue; const hit = rayBox(origin, direction, { x: barrier.x + column * size, y: barrier.y + row * size, w: Math.min(size, barrier.w - column * size), h: Math.min(size, barrier.h - row * size) }); if (hit) candidates.push({ ...hit, type: 'barrier' }); }
        if (direction.x < 0) candidates.push({ distance: -origin.x / direction.x, normal: { x: 1, y: 0 }, type: 'boundary' }); if (direction.x > 0) candidates.push({ distance: (WIDTH - origin.x) / direction.x, normal: { x: -1, y: 0 }, type: 'boundary' }); if (direction.y < 0) candidates.push({ distance: -origin.y / direction.y, normal: { x: 0, y: 1 }, type: 'boundary' }); if (direction.y > 0) candidates.push({ distance: (HEIGHT - origin.y) / direction.y, normal: { x: 0, y: -1 }, type: 'boundary' });
        // Terrain is sampled in short segments and refined, preventing a ray from tunnelling through narrow hills.
        let previous = 0, previousInside = origin.y >= terrainHeightAt(state.arena, origin.x); for (let distance = 1; distance <= limit; distance += 2) { const x = origin.x + direction.x * distance, y = origin.y + direction.y * distance, inside = y >= terrainHeightAt(state.arena, x); if (inside && !previousInside && x >= 0 && x <= WIDTH) { let low = previous, high = distance; for (let i = 0; i < 8; i += 1) { const mid = (low + high) / 2, mx = origin.x + direction.x * mid, my = origin.y + direction.y * mid; if (my >= terrainHeightAt(state.arena, mx)) high = mid; else low = mid; } const xh = origin.x + direction.x * high, slope = (terrainHeightAt(state.arena, xh + 2) - terrainHeightAt(state.arena, xh - 2)) / 4, length = Math.hypot(slope, 1); candidates.push({ distance: high, normal: { x: slope / length, y: -1 / length }, type: 'terrain' }); break; } previous = distance; previousInside = inside; }
        return candidates.filter(hit => hit.distance > 1e-4 && hit.distance <= limit).sort((a, b) => a.distance - b.distance)[0] || null;
    }
    function homingClearancePoint(state, projectile) {
        const barrier = state.arena.barrier, direction = projectile.owner ? -1 : 1, cleared = direction > 0 ? projectile.x - PROJECTILE_R > barrier.x + barrier.w + 24 : projectile.x + PROJECTILE_R < barrier.x - 24;
        let firstOccupiedRow = barrier.rows;
        occupied: for (let row = 0; row < barrier.rows; row += 1) for (let column = 0; column < barrier.columns; column += 1) if (barrier.cells[row * barrier.columns + column]) { firstOccupiedRow = row; break occupied; }
        return !cleared && firstOccupiedRow < barrier.rows ? { x: direction > 0 ? barrier.x + barrier.w + 120 : barrier.x - 120, y: Math.max(48, barrier.y + firstOccupiedRow * barrier.cellSize - 130) } : null;
    }
    function resolveLaser(state, projectile, definition = WEAPON_REGISTRY.laser) { let origin = { x: projectile.x, y: projectile.y }, length = Math.hypot(projectile.vx, projectile.vy), direction = { x: projectile.vx / length, y: projectile.vy / length }, remaining = definition.ray.maxDistance, energy = 1, bounces = 0; const baseDamage = projectile.weapon?.baseDamage ?? definition.baseDamage, segments = [], affected = []; while (remaining > 0 && energy >= definition.ray.minimumEnergy) { const hit = nearestLaserHit(state, origin, direction, remaining), distance = hit?.distance ?? remaining, end = { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance }; segments.push({ from: { ...origin }, to: end, energy: Math.round(energy * 1000) / 1000, hit: hit?.type || 'limit', index: hit?.index }); remaining -= distance; if (!hit) break; if (hit.type === 'tank') { const damage = applyDamage(state, hit.index, baseDamage * energy, { type: 'laser', owner: projectile.owner }); affected.push(damage); if (damage.healthDamage > 0 && state.statistics) { if (hit.index === projectile.owner) { if (state.tanks[projectile.owner].health > 0) state.statistics.laserSelfDamage[projectile.owner] += damage.healthDamage; } else { state.statistics.poweredHits[projectile.owner] += 1; if (bounces > 0) state.statistics.laserRicochetHits[projectile.owner] += 1; } } break; } if (bounces >= definition.ray.maxBounces) break; const dot = direction.x * hit.normal.x + direction.y * hit.normal.y; direction = { x: direction.x - 2 * dot * hit.normal.x, y: direction.y - 2 * dot * hit.normal.y }; origin = { x: end.x + direction.x * .05, y: end.y + direction.y * .05 }; energy *= definition.ray.energyRetention; bounces += 1; }
        state.laserPath = { weaponId: 'laser', owner: projectile.owner, segments, bounces, totalDistance: definition.ray.maxDistance - remaining }; state.impactSerial += 1; state.lastImpact = { serial: state.impactSerial, type: 'laser', owner: projectile.owner, affected, totalDamage: affected.reduce((sum, item) => sum + item.healthDamage, 0), path: state.laserPath }; state.impacts = [...state.impacts, state.lastImpact].slice(-14); if (affected.some(item => item.healthDamage)) state.hits += 1; return resolveShot(state, null); }
    function stepPhysics(state, dt = 1 / 120) { if (state.phase !== 'projectile-flight' || !state.projectile || !Number.isFinite(dt) || dt <= 0) return null; const projectile = state.projectile, durationSteps = Math.ceil(dt / (1 / 120)), distanceSteps = Math.ceil(Math.max(Math.abs(projectile.vx * dt), Math.abs(projectile.vy * dt + .5 * GRAVITY * dt * dt)) / 3), steps = Math.max(1, durationSteps, distanceSteps), step = dt / steps; for (let index = 0; index < steps; index += 1) { const definition = WEAPON_REGISTRY[projectile.weaponId] || DEFAULT_WEAPON; if (definition.strategy === 'homing') { projectile.age = (projectile.age || 0) + step; const target = state.tanks[1 - projectile.owner], invisible = (state.activeEffects?.[1 - projectile.owner] || []).some(effect => effect.effect === 'invisible' && effect.remainingTurns > 0), clearance = homingClearancePoint(state, projectile); if (projectile.target == null && projectile.age >= definition.homing.lockDelay && (!invisible || definition.homing.targetInvisible) && (clearance || distanceToTank(state, projectile, target) <= definition.homing.acquisitionRange)) projectile.target = 1 - projectile.owner; if (projectile.target != null && (state.tanks[projectile.target]?.health <= 0 || (invisible && !definition.homing.targetInvisible))) projectile.target = null; if (projectile.target != null) { const point = clearance || { x: target.x + TANK_W / 2, y: target.y + TANK_H / 2 }, aim = Math.atan2(point.y - projectile.y, point.x - projectile.x), current = Math.atan2(projectile.vy, projectile.vx), delta = Math.atan2(Math.sin(aim - current), Math.cos(aim - current)), turn = clamp(delta, -definition.homing.turnRate * step, definition.homing.turnRate * step), speed = Math.hypot(projectile.vx, projectile.vy) + definition.homing.acceleration * step, heading = current + turn; projectile.vx = Math.cos(heading) * speed; projectile.vy = Math.sin(heading) * speed; } } const gravity = definition.strategy === 'homing' && projectile.target != null ? 0 : GRAVITY, dx = projectile.vx * step, dy = projectile.vy * step + .5 * gravity * step * step, hit = collisionAt(state, projectile.x + dx, projectile.y + dy); projectile.x += dx; projectile.y += dy; projectile.vy += gravity * step; if (hit) return resolveShot(state, hit); } return null; }
    function resetMatch(state, seed) { const nextMatchId = (state.matchId || 0) + 1, onlineMode = Boolean(state.onlineMode), fresh = createInitialState(seed); Object.keys(state).forEach(key => delete state[key]); Object.assign(state, fresh, { matchId: nextMatchId, onlineMode }); beginTurn(state, 0); return state; }
    function snapshot(state, { includeArena = true } = {}) { const result = { stateVersion: STATE_VERSION, matchId: state.matchId || 0, phase: state.phase, activePlayer: state.activePlayer, tanks: state.tanks.map(tank => ({ ...tank })), projectile: state.projectile ? { ...state.projectile, weapon: state.projectile.weapon ? { ...state.projectile.weapon } : undefined } : null, laserPath: state.laserPath ? { ...state.laserPath, segments: state.laserPath.segments.map(segment => ({ ...segment, from: { ...segment.from }, to: { ...segment.to } })) } : null, winner: state.winner, draw: Boolean(state.draw), shots: state.shots, hits: state.hits, damageTaken: [...(state.damageTaken || [0, 0])], statistics: Object.fromEntries(Object.entries(state.statistics).map(([key, values]) => [key, values.map(value => value instanceof Set ? [...value] : value && typeof value === 'object' ? { ...value } : value)])), impacts: (state.impacts || []).map(impact => ({ ...impact, affected: (impact.affected || []).map(item => ({ ...item })) })), impactSerial: state.impactSerial || 0, lastImpact: state.lastImpact ? { ...state.lastImpact, affected: (state.lastImpact.affected || []).map(item => ({ ...item })) } : null, pickups: state.pickups.map(item => ({ ...item })), inventories: state.inventories.map(items => [...items]), equippedWeapons: [...state.equippedWeapons], weaponAmmo: state.weaponAmmo.map(ammo => ({ ...ammo })), rngSeed: state.rngSeed, effectSerial: state.effectSerial, acquisitionEventId: state.acquisitionEventId || 0, acquisitionEvents: (state.acquisitionEvents || []).map(event => ({ ...event, generatedValues: { ...event.generatedValues } })), activeEffects: state.activeEffects.map(effects => effects.map(effect => ({ ...effect }))), spawnSerial: state.spawnSerial, completedTurns: state.completedTurns, announcement: state.announcement }; if (includeArena) result.arena = { seed: state.arena.seed, terrain: [...state.arena.terrain], barrier: { ...state.arena.barrier, cells: [...state.arena.barrier.cells] } }; return result; }
    function restoreSnapshot(input) {
        const phases = new Set(['setup','aiming','projectile-flight','game-over']), terrainLength = WIDTH / TERRAIN_STEP + 1;
        if (!input || input.stateVersion !== STATE_VERSION || !phases.has(input.phase) || ![0,1].includes(input.activePlayer) || !input.arena || !Number.isInteger(input.arena.seed) || !Array.isArray(input.arena.terrain) || input.arena.terrain.length !== terrainLength || input.arena.terrain.some(value => !Number.isFinite(value) || value < 0 || value > HEIGHT) || !input.arena.barrier || !Number.isInteger(input.arena.barrier.columns) || input.arena.barrier.columns < 1 || input.arena.barrier.columns > WIDTH / BARRIER_CELL || !Number.isInteger(input.arena.barrier.rows) || input.arena.barrier.rows < 1 || input.arena.barrier.rows > HEIGHT / BARRIER_CELL || !Array.isArray(input.arena.barrier.cells) || input.arena.barrier.cells.length !== input.arena.barrier.columns * input.arena.barrier.rows || input.arena.barrier.cells.some(value => value !== 0 && value !== 1)) throw new Error('Invalid Battle Tanks save state.');
        if (!Array.isArray(input.tanks) || input.tanks.length !== 2 || input.tanks.some(tank => !tank || !Number.isFinite(tank.x) || tank.x < 0 || tank.x > WIDTH || !Number.isFinite(tank.y) || tank.y < 0 || tank.y > HEIGHT || !Number.isFinite(tank.health) || tank.health < 0 || tank.health > STARTING_HEALTH || !Number.isFinite(tank.angle) || tank.angle < 10 || tank.angle > 80 || !Number.isFinite(tank.power) || tank.power < 20 || tank.power > 100)) throw new Error('Invalid Battle Tanks save state.');
        for (const name of ['shots','hits','impactSerial','effectSerial','acquisitionEventId','spawnSerial','completedTurns']) if (!Number.isSafeInteger(input[name]) || input[name] < 0 || input[name] > 1000000) throw new Error('Invalid Battle Tanks save state.');
        if (!Number.isSafeInteger(input.rngSeed) || input.rngSeed < 0 || input.rngSeed > 0xffffffff) throw new Error('Invalid Battle Tanks save state.');
        if (!Array.isArray(input.inventories) || input.inventories.length !== 2 || input.inventories.some(items => !Array.isArray(items) || items.length > INVENTORY_LIMIT || items.some(id => !POWER_UP_CATALOG[id])) || !Array.isArray(input.activeEffects) || input.activeEffects.length !== 2 || !Array.isArray(input.statistics?.powerUpTypesUsed) || input.statistics.powerUpTypesUsed.length !== 2) throw new Error('Invalid Battle Tanks save state.');
        const restored = createInitialState(input.arena.seed), clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
        Object.assign(restored, clone(input), { onlineMode: false, resultSubmitted: false, startedAt: Date.now() });
        restored.statistics.powerUpTypesUsed = input.statistics.powerUpTypesUsed.map(values => new Set(values.filter(id => POWER_UP_CATALOG[id])));
        restored.arena = { ...input.arena, terrain: [...input.arena.terrain], barrier: { ...input.arena.barrier, cells: [...input.arena.barrier.cells] } };
        return restored;
    }

    return { STATE_VERSION, WIDTH, HEIGHT, GRAVITY, TANK_W, TANK_H, PROJECTILE_R, STARTING_HEALTH, DAMAGE, TERRAIN_STEP, BARRIER_CELL, DEFAULT_BLAST, DEFAULT_WEAPON, WEAPON_REGISTRY, POWER_UP_CATALOG, PICKUP_IDS, PICKUP_SIZE, INVENTORY_LIMIT, MAX_PICKUPS, SPAWN_EVERY_TURNS, ACQUISITION_HISTORY_LIMIT, ARENA_LIMITS, seededRandom, generateArena, terrainHeightAt, tankYAt, barrierOccupiedAt, settleTanks, resolveExplosion, isValidPickupPosition, spawnPickup, collectPickup, activatePowerUp, applyDamage, beginTurnEffects, endTurnEffects, expireEffects, advancePickupSchedule, createInitialState, beginTurn, tankBounds, moveTank, adjustAim, adjustPower, selectWeapon, fireProjectile, predictProjectile, collisionAt, nearestLaserHit, resolveLaser, stepPhysics, resolveShot, resetMatch, snapshot, restoreSnapshot };
}));
