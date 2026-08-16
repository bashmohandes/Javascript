'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const SESSION_DAYS = 30;
const GAMES = new Set(['pong', 'sudoku', 'minesweeper', 'tictactoe', 'battletanks']);
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const normalizeGamertag = value => String(value || '').trim();
const scrypt = promisify(crypto.scrypt);

async function hashPasscode(passcode, salt = crypto.randomBytes(16)) {
    const derived = await scrypt(passcode, salt, 64);
    return `scrypt:${salt.toString('base64url')}:${derived.toString('base64url')}`;
}

async function verifyPasscode(passcode, encoded) {
    const [, saltValue, hashValue] = String(encoded).split(':');
    if (!saltValue || !hashValue) return false;
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = await scrypt(passcode, Buffer.from(saltValue, 'base64url'), expected.length);
    return crypto.timingSafeEqual(expected, actual);
}

function publicUser(row) { return row ? { id: row.id, gamertag: row.gamertag, createdAt: row.created_at } : null; }
function isUniqueConstraint(error) { return String(error.code || '').includes('CONSTRAINT') || /UNIQUE constraint/i.test(error.message); }

class Accounts {
    constructor(database, achievements = null) { this.database = database; this.achievements = achievements; }

    validateCredentials(gamertag, passcode) {
        if (!/^[A-Za-z0-9_-]{3,24}$/.test(gamertag)) throw new Error('Gamertag must be 3–24 letters, numbers, underscores, or hyphens.');
        if (passcode.length < 4 || passcode.length > 128) throw new Error('Passcode must be 4–128 characters.');
    }

    async create(gamertagValue, passcodeValue) {
        const gamertag = normalizeGamertag(gamertagValue), passcode = String(passcodeValue || '');
        this.validateCredentials(gamertag, passcode);
        try {
            const result = this.database.prepare('INSERT INTO users (gamertag, passcode_hash) VALUES (?, ?)').run(gamertag, await hashPasscode(passcode));
            return publicUser(this.database.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid));
        } catch (error) {
            if (isUniqueConstraint(error)) throw new Error('That gamertag is already taken.');
            throw error;
        }
    }

    async authenticate(gamertagValue, passcodeValue) {
        const row = this.database.prepare('SELECT * FROM users WHERE gamertag = ? COLLATE NOCASE').get(normalizeGamertag(gamertagValue));
        if (!row || !await verifyPasscode(String(passcodeValue || ''), row.passcode_hash)) throw new Error('Gamertag or passcode is incorrect.');
        return publicUser(row);
    }

    createSession(userId) {
        const token = crypto.randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
        this.database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
        this.database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), userId, expiresAt);
        return { token, expiresAt };
    }

    userForToken(token) {
        if (!token) return null;
        return publicUser(this.database.prepare('SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?').get(hashToken(token), new Date().toISOString()));
    }

    deleteSession(token) { if (token) this.database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token)); }

    async update(userId, changes) {
        const current = this.database.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!current) throw new Error('User not found.');
        const gamertag = changes.gamertag === undefined ? current.gamertag : normalizeGamertag(changes.gamertag);
        const passcode = changes.passcode === undefined || changes.passcode === '' ? null : String(changes.passcode);
        if (!await verifyPasscode(String(changes.currentPasscode || ''), current.passcode_hash)) throw new Error('Current passcode is incorrect.');
        this.validateCredentials(gamertag, passcode || 'keep');
        try {
            const passcodeHash = passcode ? await hashPasscode(passcode) : current.passcode_hash;
            this.database.exec('BEGIN IMMEDIATE');
            this.database.prepare('UPDATE users SET gamertag = ?, passcode_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(gamertag, passcodeHash, userId);
            this.database.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
            this.database.exec('COMMIT');
        } catch (error) {
            if (this.database.isTransaction) this.database.exec('ROLLBACK');
            if (isUniqueConstraint(error)) throw new Error('That gamertag is already taken.');
            throw error;
        }
        return publicUser(this.database.prepare('SELECT * FROM users WHERE id = ?').get(userId));
    }

    record(userId, result, options = {}) {
        const game = String(result.game || '').toLowerCase();
        if (!GAMES.has(game)) throw new Error('Unknown game.');
        const details = result.details && typeof result.details === 'object' && !Array.isArray(result.details) ? result.details : {};
        const { score, won, normalizedDetails } = validateResult(game, result.won, details, options.trustedOnline === true);
        const encoded = JSON.stringify(normalizedDetails);
        if (encoded.length > 2000) throw new Error('Game details are too large.');
        const topEntry = () => this.database.prepare(`SELECT game_results.id, users.gamertag, game_results.score,
                COALESCE(json_extract(game_results.details, '$.seconds'), 86401) seconds
            FROM game_results JOIN users ON users.id = game_results.user_id
            WHERE game_results.game = ?
            ORDER BY game_results.score DESC, seconds ASC, game_results.played_at ASC, game_results.id ASC
            LIMIT 1`).get(game);
        const previousTop = topEntry();
        const insert = this.database.prepare('INSERT INTO game_results (user_id, game, score, won, details) VALUES (?, ?, ?, ?, ?)').run(userId, game, score, won ? 1 : 0, encoded);
        const unlocked = this.achievements?.process(userId, game, 'result', { game, won, score, details: normalizedDetails }) || [];
        const newTop = previousTop ? topEntry() : null;
        const topScore = newTop && Number(newTop.id) === Number(insert.lastInsertRowid)
            ? { game, previousScore: previousTop.score, newScore: score, previousHolder: previousTop.gamertag, previousSeconds: previousTop.seconds, newSeconds: newTop.seconds }
            : null;
        return { id: Number(insert.lastInsertRowid), score, unlocked, topScore };
    }

    profile(userId, pageValue = 1, pageSizeValue = 10) {
        const page = Math.max(1, Number.parseInt(pageValue, 10) || 1);
        const pageSize = Math.min(10, Math.max(1, Number.parseInt(pageSizeValue, 10) || 10));
        const user = publicUser(this.database.prepare('SELECT * FROM users WHERE id = ?').get(userId));
        const totals = this.database.prepare('SELECT game, COUNT(*) games_played, SUM(won) wins, MAX(score) best_score FROM game_results WHERE user_id = ? GROUP BY game').all(userId);
        const totalGames = this.database.prepare('SELECT COUNT(*) total FROM game_results WHERE user_id = ?').get(userId).total;
        const totalPages = Math.max(1, Math.ceil(totalGames / pageSize));
        const currentPage = Math.min(page, totalPages);
        const recent = this.database.prepare('SELECT id, game, score, won, details, played_at FROM game_results WHERE user_id = ? ORDER BY played_at DESC, id DESC LIMIT ? OFFSET ?').all(userId, pageSize, (currentPage - 1) * pageSize).map(row => ({ ...row, won: Boolean(row.won), details: JSON.parse(row.details) }));
        const achievements = this.achievements?.list(userId) || [];
        return { user, totals, recent, achievements, pagination: { page: currentPage, pageSize, totalGames, totalPages } };
    }

    leaderboard(gameValue) {
        const game = String(gameValue || '').toLowerCase();
        if (!GAMES.has(game)) throw new Error('Unknown game.');
        return this.database.prepare(`SELECT users.gamertag, ranked.score, ranked.won, ranked.details, ranked.played_at
            FROM game_results ranked JOIN users ON users.id = ranked.user_id
            WHERE ranked.game = ? AND ranked.id = (SELECT best.id FROM game_results best WHERE best.user_id = ranked.user_id AND best.game = ranked.game ORDER BY best.score DESC, COALESCE(json_extract(best.details, '$.seconds'), 86401) ASC, best.played_at ASC, best.id ASC LIMIT 1)
            ORDER BY ranked.score DESC, COALESCE(json_extract(ranked.details, '$.seconds'), 86401) ASC, ranked.played_at ASC, ranked.id ASC LIMIT 20`).all(game).map(row => ({ ...row, won: Boolean(row.won), details: JSON.parse(row.details) }));
    }
}

function integer(value, minimum, maximum, label) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < minimum || number > maximum) throw new Error(`Invalid ${label}.`);
    return number;
}

function validateResult(game, wonValue, details, trustedOnline = false) {
    const won = wonValue === true;
    if (game === 'battletanks') {
        if (!['local', 'online'].includes(details.mode)) throw new Error('Invalid Battle Tanks mode.');
        if (details.mode === 'online' && !trustedOnline) throw new Error('Invalid Battle Tanks mode.');
        const field = (name, minimum, maximum) => {
            if (typeof details[name] !== 'number' || !Number.isFinite(details[name]) || !Number.isSafeInteger(details[name])) throw new Error(`Invalid Battle Tanks ${name}.`);
            return integer(details[name], minimum, maximum, `Battle Tanks ${name}`);
        };
        const winner = field('winner', 1, 2), turns = field('turns', 2, 200), shots = field('shots', details.mode === 'local' ? 2 : 0, 200);
        const hits = field('hits', details.mode === 'local' ? 2 : 0, shots), seconds = field('seconds', 1, 7200), damageTaken = field('damageTaken', 0, 100);
        const credibleHealth = winner === 1 ? damageTaken < 100 : damageTaken === 100;
        if ((details.mode === 'local' && turns !== shots) || (details.mode === 'online' && shots > turns) || won !== (winner === 1) || !credibleHealth) throw new Error('Invalid Battle Tanks result.');
        // Wins rank above losses. Accuracy is worth up to 5,000 points, while
        // fewer turns break otherwise equal matches: 10,000*win + 5,000*hits/shots + 10*(200-turns).
        const score = (won ? 10000 : 0) + Math.floor(hits * 5000 / shots) + (200 - turns) * 10;
        const accuracy = Math.floor(hits * 100 / shots);
        // Expanded clients may report these counters, while older result payloads
        // remain valid. Unknown weapon ids and malformed optional fields are
        // rejected rather than being persisted as untrusted achievement data.
        const optional = {};
        if (details.weapons !== undefined) {
            if (!details.weapons || typeof details.weapons !== 'object' || Array.isArray(details.weapons)) throw new Error('Invalid Battle Tanks weapons.');
            const allowed = new Set(['shell', 'wide-blast', 'heavy-shell', 'homing', 'laser']), weapons = {};
            for (const [id, count] of Object.entries(details.weapons)) { if (!allowed.has(id) || !Number.isSafeInteger(count) || count < 0 || count > shots) throw new Error('Invalid Battle Tanks weapons.'); weapons[id] = count; }
            if (Object.values(weapons).reduce((sum, count) => sum + count, 0) > shots) throw new Error('Invalid Battle Tanks weapons.');
            optional.weapons = weapons;
        }
        for (const [name, maximum] of [['splashDamage', 20000], ['healing', 20000], ['powerUps', 200]]) if (details[name] !== undefined) optional[name] = field(name, 0, maximum);
        return { won, score, normalizedDetails: { mode: details.mode, winner, turns, shots, hits, accuracy, seconds, damageTaken, ...optional } };
    }
    if (game === 'tictactoe') {
        if (!['solo-easy', 'solo-medium', 'solo-hard', 'duo', 'online'].includes(details.mode)) throw new Error('Invalid Tic-tac-toe mode.');
        const seconds = integer(details.seconds, 1, 86400, 'Tic-tac-toe time');
        const moves = integer(details.moves, 3, 9, 'Tic-tac-toe move count');
        return { won, score: won ? 1000 + (10 - moves) * 100 + Math.max(0, 300 - seconds) : 0, normalizedDetails: { mode: details.mode, seconds, moves, outcome: won ? 'win' : details.outcome === 'draw' ? 'draw' : 'loss' } };
    }
    if (game === 'sudoku') {
        if (!['easy', 'medium', 'hard'].includes(details.difficulty)) throw new Error('Invalid Sudoku difficulty.');
        const seconds = integer(details.seconds, won ? 1 : 0, 86400, 'Sudoku time');
        const mistakes = integer(details.mistakes, 0, 3, 'mistake count');
        const hintsUsed = integer(details.hintsUsed, 0, 3, 'hint count');
        const base = { easy: 1000, medium: 2000, hard: 3500 }[details.difficulty];
        return { won, score: won ? Math.max(1, base - seconds - mistakes * 100 + (3 - hintsUsed) * 50) : 0, normalizedDetails: { difficulty: details.difficulty, seconds, mistakes, hintsUsed } };
    }
    if (game === 'minesweeper') {
        if (!['easy', 'medium', 'hard'].includes(details.difficulty)) throw new Error('Invalid Minesweeper difficulty.');
        const seconds = integer(details.seconds, won ? 1 : 0, 86400, 'Minesweeper time');
        const base = { easy: 1000, medium: 3000, hard: 6000 }[details.difficulty];
        return { won, score: won ? Math.max(1, base - seconds) : 0, normalizedDetails: { difficulty: details.difficulty, seconds } };
    }
    if (!['solo', 'duo', 'online'].includes(details.mode) || !/^\d-\d$/.test(String(details.score))) throw new Error('Invalid Pong result.');
    const [player, opponent] = String(details.score).split('-').map(Number);
    if ((player !== 7 && opponent !== 7) || (player === 7 && opponent === 7) || won !== (player === 7)) throw new Error('Invalid Pong result.');
    const seconds = integer(details.seconds, 1, 86400, 'Pong time');
    return { won, score: player * 100 + opponent, normalizedDetails: { mode: details.mode, score: `${player}-${opponent}`, seconds } };
}

module.exports = { Accounts, hashPasscode, verifyPasscode, validateResult };
