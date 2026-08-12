'use strict';

const GAMES = ['pong', 'sudoku', 'minesweeper', 'tictactoe'];
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
    { id: 'tic-speed', game: 'tictactoe', icon: '💨', title: 'Blink and You Missed X', condition: 'Win Tic-tac-toe in five moves or fewer.', event: 'result', where: { won: true, 'details.moves': { lte: 5 } }, target: 1 }
];

function valueAt(object, path) { return path.split('.').reduce((value, key) => value?.[key], object); }
function matches(rule, payload) {
    return Object.entries(rule || {}).every(([path, expected]) => {
        const actual = valueAt(payload, path);
        if (expected && typeof expected === 'object') return (expected.lte === undefined || actual <= expected.lte) && (expected.gte === undefined || actual >= expected.gte);
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
