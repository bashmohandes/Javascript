(function (root, factory) {
    'use strict';
    const api = factory(root.BattleTanksCore);
    if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./game'));
    root.BattleTanksAI = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
    'use strict';
    if (!core) throw new Error('Battle Tanks mechanics are required by the CPU player.');

    const copy = value => {
        if (value instanceof Set) return new Set([...value].map(copy));
        if (Array.isArray(value)) return value.map(copy);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
        return value;
    };
    const availableWeapons = (state, side) => Object.values(core.WEAPON_REGISTRY).filter(weapon => weapon.ammo.unlimited || state.weaponAmmo?.[side]?.[weapon.id] > 0);
    const decisionRandom = (state, salt) => core.seededRandom(((state.arena?.seed || 0) ^ Math.imul((state.shots || 0) + 1, salt)) >>> 0);
    const COARSE_ANGLES = [12, 20, 28, 36, 44, 52, 60, 68, 76, 80];
    const COARSE_POWERS = [20, 30, 40, 50, 60, 70, 80, 90, 100];
    const REFINEMENT_LIMIT = 12;

    function pickupMove(state, side, tank, bounds) {
        if ((state.inventories?.[side]?.length || 0) >= core.INVENTORY_LIMIT) return null;
        const reachable = (state.pickups || []).filter(pickup => Number.isFinite(pickup?.x) && pickup.x + core.PICKUP_SIZE / 2 > bounds.min && pickup.x - core.PICKUP_SIZE / 2 < bounds.max + core.TANK_W).map(pickup => {
            const collectionX = Math.max(bounds.min, Math.min(bounds.max, pickup.x - core.TANK_W / 2));
            return { pickup, collectionX, distance: Math.abs(collectionX - tank.x) };
        }).sort((a,b) => a.distance - b.distance || a.pickup.serial - b.pickup.serial);
        if (!reachable.length || reachable[0].distance < .5) return null;
        const target = reachable[0], directionSign = Math.sign(target.collectionX - tank.x), amount = Math.min(104, target.distance), targetX = tank.x + directionSign * amount;
        return { direction: directionSign < 0 ? (side ? 'forward' : 'backward') : (side ? 'backward' : 'forward'), amount, startX: tank.x, targetX, reason: 'pickup', pickupSerial: target.pickup.serial, pickupId: target.pickup.id };
    }

    function planMove(state, side = 1) {
        if (!state || state.phase !== 'aiming' || state.activePlayer !== side) return null;
        const tank = state.tanks?.[side], bounds = core.tankBounds(state, side);
        if (!tank || !Number.isFinite(tank.x)) return null;
        const collection = pickupMove(state, side, tank, bounds);
        if (collection) return collection;
        const random = decisionRandom(state, 0x85ebca6b), preferred = random() < .5 ? 'forward' : 'backward', directions = [preferred, preferred === 'forward' ? 'backward' : 'forward'];
        const deltaFor = direction => direction === 'forward' ? (side ? -1 : 1) : (side ? 1 : -1);
        const capacityFor = direction => deltaFor(direction) < 0 ? tank.x - bounds.min : bounds.max - tank.x;
        const direction = directions.find(item => capacityFor(item) >= 48) || directions.sort((a,b) => capacityFor(b) - capacityFor(a))[0], desired = 48 + Math.floor(random() * 57), amount = Math.max(0, Math.min(desired, capacityFor(direction))), targetX = Math.max(bounds.min, Math.min(bounds.max, tank.x + deltaFor(direction) * amount));
        return { direction, amount: Math.abs(targetX - tank.x), startX: tank.x, targetX, reason: 'reposition' };
    }

    function planPowerUps(state, side = 1) {
        if (!state || state.phase !== 'aiming' || state.activePlayer !== side) return [];
        const tank = state.tanks?.[side], effects = new Set((state.activeEffects?.[side] || []).map(effect => effect.effect)), planned = [];
        let projectedHealth = Number(tank?.health) || 0;
        for (const id of state.inventories?.[side] || []) {
            const item = core.POWER_UP_CATALOG[id];
            if (!item || item.onlineOnly) continue;
            if (item.kind === 'weapon') planned.push(id);
            else if (item.effect === 'heal') { if (projectedHealth < core.STARTING_HEALTH) { planned.push(id); projectedHealth = Math.min(core.STARTING_HEALTH, projectedHealth + item.amount); } }
            else if (!effects.has(item.effect)) { planned.push(id); effects.add(item.effect); }
        }
        return planned;
    }

    function simulateShot(state, side, weaponId, angle, power) {
        const trial = copy(state), tank = trial.tanks[side], target = trial.tanks[1 - side], startingTargetHealth = target.health, startingSelfHealth = tank.health;
        trial.activePlayer = side; trial.phase = 'aiming'; tank.angle = angle; tank.power = power;
        if (!core.selectWeapon(trial, side, weaponId) || !core.fireProjectile(trial)) return null;
        for (let step = 0; step < 1800 && trial.phase === 'projectile-flight'; step += 1) core.stepPhysics(trial, 1 / 120);
        const impact = trial.lastImpact, targetDamage = Math.max(0, startingTargetHealth - trial.tanks[1 - side].health), selfDamage = Math.max(0, startingSelfHealth - trial.tanks[side].health);
        const distance = impact && Number.isFinite(impact.x) && Number.isFinite(impact.y) ? Math.hypot(impact.x - (target.x + core.TANK_W / 2), impact.y - (target.y + core.TANK_H / 2)) : 2000;
        return { angle, power, weaponId, targetDamage, selfDamage, distance, score: targetDamage * 120 - selfDamage * 150 - Math.min(distance, 2000) };
    }

    function candidatePool(candidates, intendsHit) {
        const safe = candidates.filter(candidate => candidate.selfDamage === 0);
        const partialHits = safe.filter(candidate => candidate.targetDamage >= 15 && candidate.targetDamage <= 38).sort((a,b) => Math.abs(a.targetDamage - 28) - Math.abs(b.targetDamage - 28) || a.distance - b.distance);
        const allHits = safe.filter(candidate => candidate.targetDamage > 0).sort((a,b) => Math.abs(a.targetDamage - 28) - Math.abs(b.targetDamage - 28) || a.distance - b.distance);
        const nearMisses = safe.filter(candidate => candidate.targetDamage === 0 && candidate.distance >= 70 && candidate.distance <= 280).sort((a,b) => Math.abs(a.distance - 155) - Math.abs(b.distance - 155));
        const allMisses = safe.filter(candidate => candidate.targetDamage === 0).sort((a,b) => a.distance - b.distance);
        const pool = intendsHit ? (partialHits.length ? partialHits : allHits) : (nearMisses.length ? nearMisses : allMisses);
        return pool.length ? pool : safe.length ? safe : candidates;
    }

    function planShot(state, side = 1) {
        if (!state || state.phase !== 'aiming' || state.activePlayer !== side) return null;
        // First sample a deliberately small grid, then refine only the most
        // promising neighborhoods. This keeps the deterministic, mechanics-
        // accurate planner while bounding synchronous work on the UI thread.
        const random = decisionRandom(state, 0x9e3779b1), intendsHit = random() < .55, candidates = [], sampled = new Set();
        const sample = (weaponId, angle, power) => {
            const boundedAngle = Math.max(10, Math.min(80, Math.round(angle))), boundedPower = Math.max(20, Math.min(100, Math.round(power))), key = `${weaponId}:${boundedAngle}:${boundedPower}`;
            if (sampled.has(key)) return;
            sampled.add(key);
            const candidate = simulateShot(state, side, weaponId, boundedAngle, boundedPower);
            if (candidate) candidates.push(candidate);
        };
        for (const weapon of availableWeapons(state, side)) {
            for (const angle of COARSE_ANGLES) for (const power of COARSE_POWERS) sample(weapon.id, angle, power);
        }
        if (!candidates.length) return { angle: 45, power: 60, weaponId: 'shell', targetDamage: 0, selfDamage: 0, distance: Infinity, score: -Infinity, intent: 'miss' };
        const seeds = candidatePool(candidates, intendsHit).slice(0, REFINEMENT_LIMIT);
        for (const seed of seeds) for (const angleOffset of [-4, 0, 4]) for (const powerOffset of [-5, 0, 5]) sample(seed.weaponId, seed.angle + angleOffset, seed.power + powerOffset);
        // The normal CPU is intentionally fallible. A match-seeded choice keeps
        // replays deterministic while alternating credible grazes and near misses.
        const choices = candidatePool(candidates, intendsHit).slice(0,18), selected = choices[Math.floor(random() * choices.length)];
        return { ...selected, intent: intendsHit && selected.targetDamage > 0 ? 'hit' : 'miss' };
    }

    return { planMove, planPowerUps, planShot, simulateShot };
}));
