'use strict';

const GAMES = ['pong', 'sudoku', 'minesweeper', 'tictactoe', 'battletanks', 'tetris'];
const catalog = [
    { id: 'pong-first-point', game: 'pong', icon: '🏓', title: 'Paddle Me This', condition: 'Finish your first Pong match.', event: 'result', target: 1 },
    { id: 'pong-winner', game: 'pong', icon: '🧱', title: 'The Wall Has Wi-Fi', condition: 'Win a Pong match.', event: 'result', where: { won: true }, target: 1 },
    { id: 'pong-shutout', game: 'pong', icon: '🥯', title: 'Freshly Bageled', condition: 'Win Pong 7–0.', event: 'result', where: { won: true, 'details.score': '7-0' }, target: 1 },
    { id: 'pong-online', game: 'pong', icon: '🌐', title: 'Ping Meets Pong', condition: 'Finish an online Pong match.', event: 'result', where: { 'details.mode': 'online' }, target: 1 },
    { id: 'sudoku-first', game: 'sudoku', icon: '9️⃣', title: 'Nine-Nine Problems', condition: 'Complete a Sudoku puzzle.', event: 'result', where: { won: true }, target: 1 },
    { id: 'sudoku-clean', game: 'sudoku', icon: '🧼', title: 'Eraser? I Hardly Know Her', condition: 'Complete Sudoku with no mistakes and no hints.', event: 'result', where: { won: true, 'details.mistakes': 0, 'details.hintsUsed': 0 }, target: 1 },
    { id: 'sudoku-hard', game: 'sudoku', icon: '🧠', title: 'Certified Big Grid Energy', condition: 'Complete a Hard Sudoku puzzle.', event: 'result', where: { won: true, 'details.difficulty': 'hard' }, target: 1 },
    { id: 'sudoku-five', game: 'sudoku', icon: '✋', title: 'Can Count Past Nine', condition: 'Complete five Sudoku puzzles.', event: 'result', where: { won: true }, target: 5 },
    { id: 'mines-first', game: 'minesweeper', icon: '💣', title: 'Mine Over Matter', condition: 'Clear a Minesweeper field.', event: 'result', where: { won: true }, target: 1 },
    { id: 'mines-hard', game: 'minesweeper', icon: '🕶️', title: '99 Problems, All Defused', condition: 'Clear a Hard Minesweeper field.', event: 'result', where: { won: true, 'details.difficulty': 'hard' }, target: 1 },
    { id: 'mines-speed', game: 'minesweeper', icon: '⚡', title: 'Swept Off Your Feet', condition: 'Clear any field in under 60 seconds.', event: 'result', where: { won: true, 'details.seconds': { lte: 59 } }, target: 1 },
    { id: 'mines-five', game: 'minesweeper', icon: '🧹', title: 'Keeping It Mine and Tidy', condition: 'Clear five Minesweeper fields.', event: 'result', where: { won: true }, target: 5 },
    { id: 'tic-first', game: 'tictactoe', icon: '❌', title: 'X Marks the Start', condition: 'Finish a Tic-tac-toe game.', event: 'result', target: 1 },
    { id: 'tic-hard', game: 'tictactoe', icon: '🤖', title: 'Artificial Unintelligence', condition: 'Beat the computer on Hard.', event: 'result', where: { won: true, 'details.mode': 'solo-hard' }, target: 1 },
    { id: 'tic-online', game: 'tictactoe', icon: '📡', title: 'Three Bars, Three Marks', condition: 'Finish an online Tic-tac-toe match.', event: 'result', where: { 'details.mode': 'online' }, target: 1 },
    { id: 'tic-speed', game: 'tictactoe', icon: '💨', title: 'Blink and You Missed X', condition: 'Win Tic-tac-toe in five moves or fewer.', event: 'result', where: { won: true, 'details.moves': { lte: 5 } }, target: 1 },
    { id: 'tetris-first', game: 'tetris', icon: '🧱', title: 'Block Party', condition: 'Finish your first Tetris run.', event: 'result', target: 1 },
    { id: 'tetris-four-line', game: 'tetris', icon: '4️⃣', title: 'Fourgone Conclusion', condition: 'Clear four lines at once.', event: 'result', where: { 'details.tetrises': { gte: 1 } }, target: 1 },
    { id: 'tetris-level-ten', game: 'tetris', icon: '🔟', title: 'Double Digits', condition: 'Reach level 10.', event: 'result', where: { 'details.level': { gte: 10 } }, target: 1 },
    { id: 'tetris-five', game: 'tetris', icon: '🏗️', title: 'Piece and Persist', condition: 'Finish five Tetris runs.', event: 'result', target: 5 },
    { id: 'tanks-first', game: 'battletanks', icon: '🏁', title: 'Battle Tested', condition: 'Finish a Battle Tanks match.', event: 'result', target: 1 },
    { id: 'tanks-win', game: 'battletanks', icon: '🏆', title: 'Tank Commander', condition: 'Win a Battle Tanks match.', event: 'result', where: { won: true }, target: 1 },
    { id: 'tanks-accurate', game: 'battletanks', icon: '🎯', title: 'Deadeye', condition: 'Win with at least 50% accuracy.', event: 'result', where: { won: true, 'details.accuracy': { gte: 50 } }, target: 1 },
    { id: 'tanks-untouched', game: 'battletanks', icon: '🛡️', title: 'Untouchable', condition: 'Win without taking damage.', event: 'result', where: { won: true, 'details.damageTaken': 0 }, target: 1 },
    { id: 'tanks-online', game: 'battletanks', icon: '🌐', title: 'Long-Distance Call', condition: 'Finish an online Battle Tanks match.', event: 'result', where: { 'details.mode': 'online' }, target: 1 },
    { id: 'tanks-power-first', game: 'battletanks', icon: '🃏', title: 'Card on the Table', condition: 'Acquire your first power-up.', event: 'result', where: { 'details.powerUpsAcquired': { gte: 1 } }, target: 1 },
    { id: 'tanks-power-variety', game: 'battletanks', icon: '🎴', title: 'Full Deck', condition: 'Use three different power-up types in one match.', event: 'result', where: { 'details.powerUpTypesUsed': { lengthGte: 3 } }, target: 1 },
    { id: 'tanks-shield-break', game: 'battletanks', icon: '🛡️', title: 'Not Even a Scratch', condition: 'Absorb at least 50 damage with shields in one match.', event: 'result', where: { 'details.shieldDamageAbsorbed': { gte: 50 } }, target: 1 },
    { id: 'tanks-second-wind', game: 'battletanks', icon: '💚', title: 'Back in the Fight', condition: 'Restore at least 25 health with health packs and win.', event: 'result', where: { won: true, 'details.healthRestored': { gte: 25 } }, target: 1 },
    { id: 'tanks-invisible-win', game: 'battletanks', icon: '👻', title: 'Now You See Me', condition: 'Win an online match after activating invisibility.', event: 'result', where: { won: true, 'details.mode': 'online', 'details.invisibilityActivations': { gte: 1 } }, target: 1 },
    { id: 'tanks-laser-ricochet', game: 'battletanks', icon: '📐', title: 'Geometry Wins', condition: 'Damage an opponent with a reflected laser.', event: 'result', where: { 'details.laserRicochetHits': { gte: 1 } }, target: 1 },
    { id: 'tanks-laser-self-hit', game: 'battletanks', icon: '⚠️', title: 'Calculated Risk', condition: 'Survive damage from your own reflected laser.', event: 'result', where: { 'details.laserSelfDamage': { gte: 1 } }, target: 1 },
    { id: 'tanks-homing-hit', game: 'battletanks', icon: '↩️', title: 'Return to Sender', condition: 'Damage an opponent with a homing projectile.', event: 'result', where: { 'details.homingHits': { gte: 1 } }, target: 1 },
    { id: 'tanks-heavy-hit', game: 'battletanks', icon: '💥', title: 'Heavy Artillery', condition: 'Deal at least 40 health damage with one heavy projectile.', event: 'result', where: { 'details.heavyProjectileMaxDamage': { gte: 40 } }, target: 1 },
    { id: 'tanks-powered-win', game: 'battletanks', icon: '⚡', title: 'Power Player', condition: 'Win after two power-up-powered hits.', event: 'result', where: { won: true, 'details.poweredHits': { gte: 2 } }, target: 1 },
    { id: 'tanks-power-collector', game: 'battletanks', icon: '🗂️', title: 'Deck Builder', condition: 'Finish ten matches in which you acquired a power-up.', event: 'result', where: { 'details.powerUpsAcquired': { gte: 1 } }, target: 10 }
];

function valueAt(object, path) { return path.split('.').reduce((value, key) => value?.[key], object); }
function matches(rule, payload) {
    return Object.entries(rule || {}).every(([path, expected]) => {
        const actual = valueAt(payload, path);
        if (expected && typeof expected === 'object') return (expected.lte === undefined || actual <= expected.lte) && (expected.gte === undefined || actual >= expected.gte) && (expected.gt === undefined || actual > expected.gt) && (expected.lengthGte === undefined || (Array.isArray(actual) && actual.length >= expected.lengthGte)) && (expected.includes === undefined || (Array.isArray(actual) && actual.includes(expected.includes)));
        return actual === expected;
    });
}
function publicAchievement(item, row) {
    return { id: item.id, game: item.game, icon: item.icon, title: item.title, condition: item.condition, target: item.target, progress: Math.min(row?.progress || 0, item.target), unlocked: Boolean(row?.unlocked_at), unlockedAt: row?.unlocked_at || null };
}

class Achievements {
    constructor(database) { this.database = database; }
    list(userId, game) {
        if (game && !GAMES.includes(game)) throw new Error('Unknown game.');
        const rows = userId ? this.database.prepare('SELECT * FROM achievement_progress WHERE user_id = ?').all(userId) : [];
        const state = new Map(rows.map(row => [row.achievement_id, row]));
        return catalog.filter(item => !game || item.game === game).map(item => publicAchievement(item, state.get(item.id)));
    }
    process(userId, game, event, payload) {
        const unlocked = [];
        for (const item of catalog.filter(item => item.game === game && item.event === event && matches(item.where, payload))) {
            const existing = this.database.prepare('SELECT * FROM achievement_progress WHERE user_id = ? AND achievement_id = ?').get(userId, item.id);
            if (existing?.unlocked_at) continue;
            const progress = Math.min(item.target, (existing?.progress || 0) + 1);
            this.database.prepare(`INSERT INTO achievement_progress (user_id, achievement_id, progress, unlocked_at) VALUES (?, ?, ?, CASE WHEN ? >= ? THEN CURRENT_TIMESTAMP END)
                ON CONFLICT(user_id, achievement_id) DO UPDATE SET progress = excluded.progress, unlocked_at = CASE WHEN excluded.progress >= ? THEN CURRENT_TIMESTAMP ELSE NULL END, updated_at = CURRENT_TIMESTAMP`).run(userId, item.id, progress, progress, item.target, item.target);
            const row = this.database.prepare('SELECT * FROM achievement_progress WHERE user_id = ? AND achievement_id = ?').get(userId, item.id);
            if (row.unlocked_at) unlocked.push(publicAchievement(item, row));
        }
        return unlocked;
    }
}

module.exports = { Achievements, catalog, matches };
