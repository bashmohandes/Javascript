'use strict';

const crypto = require('node:crypto');

const SESSION_DAYS = 30;
const GAMES = new Set(['pong', 'sudoku', 'minesweeper']);
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const normalizeGamertag = value => String(value || '').trim();

function hashPasscode(passcode, salt = crypto.randomBytes(16)) {
    const derived = crypto.scryptSync(passcode, salt, 64);
    return `scrypt:${salt.toString('base64url')}:${derived.toString('base64url')}`;
}

function verifyPasscode(passcode, encoded) {
    const [, saltValue, hashValue] = String(encoded).split(':');
    if (!saltValue || !hashValue) return false;
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = crypto.scryptSync(passcode, Buffer.from(saltValue, 'base64url'), expected.length);
    return crypto.timingSafeEqual(expected, actual);
}

function publicUser(row) { return row ? { id: row.id, gamertag: row.gamertag, createdAt: row.created_at } : null; }
function isUniqueConstraint(error) { return String(error.code || '').includes('CONSTRAINT') || /UNIQUE constraint/i.test(error.message); }

class Accounts {
    constructor(database) { this.database = database; }

    validateCredentials(gamertag, passcode) {
        if (!/^[A-Za-z0-9_-]{3,24}$/.test(gamertag)) throw new Error('Gamertag must be 3–24 letters, numbers, underscores, or hyphens.');
        if (passcode.length < 4 || passcode.length > 128) throw new Error('Passcode must be 4–128 characters.');
    }

    create(gamertagValue, passcodeValue) {
        const gamertag = normalizeGamertag(gamertagValue), passcode = String(passcodeValue || '');
        this.validateCredentials(gamertag, passcode);
        try {
            const result = this.database.prepare('INSERT INTO users (gamertag, passcode_hash) VALUES (?, ?)').run(gamertag, hashPasscode(passcode));
            return publicUser(this.database.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid));
        } catch (error) {
            if (isUniqueConstraint(error)) throw new Error('That gamertag is already taken.');
            throw error;
        }
    }

    authenticate(gamertagValue, passcodeValue) {
        const row = this.database.prepare('SELECT * FROM users WHERE gamertag = ? COLLATE NOCASE').get(normalizeGamertag(gamertagValue));
        if (!row || !verifyPasscode(String(passcodeValue || ''), row.passcode_hash)) throw new Error('Gamertag or passcode is incorrect.');
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

    update(userId, changes) {
        const current = this.database.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!current) throw new Error('User not found.');
        const gamertag = changes.gamertag === undefined ? current.gamertag : normalizeGamertag(changes.gamertag);
        const passcode = changes.passcode === undefined || changes.passcode === '' ? null : String(changes.passcode);
        this.validateCredentials(gamertag, passcode || 'keep');
        try {
            this.database.prepare('UPDATE users SET gamertag = ?, passcode_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(gamertag, passcode ? hashPasscode(passcode) : current.passcode_hash, userId);
        } catch (error) {
            if (isUniqueConstraint(error)) throw new Error('That gamertag is already taken.');
            throw error;
        }
        return publicUser(this.database.prepare('SELECT * FROM users WHERE id = ?').get(userId));
    }

    record(userId, result) {
        const game = String(result.game || '').toLowerCase(), score = Number(result.score);
        if (!GAMES.has(game)) throw new Error('Unknown game.');
        if (!Number.isSafeInteger(score) || score < 0 || score > 100000000) throw new Error('Score must be a non-negative integer.');
        const details = result.details && typeof result.details === 'object' && !Array.isArray(result.details) ? result.details : {};
        const encoded = JSON.stringify(details);
        if (encoded.length > 2000) throw new Error('Game details are too large.');
        const insert = this.database.prepare('INSERT INTO game_results (user_id, game, score, won, details) VALUES (?, ?, ?, ?, ?)').run(userId, game, score, result.won ? 1 : 0, encoded);
        return { id: Number(insert.lastInsertRowid) };
    }

    profile(userId) {
        const user = publicUser(this.database.prepare('SELECT * FROM users WHERE id = ?').get(userId));
        const totals = this.database.prepare('SELECT game, COUNT(*) games_played, SUM(won) wins, MAX(score) best_score FROM game_results WHERE user_id = ? GROUP BY game').all(userId);
        const recent = this.database.prepare('SELECT id, game, score, won, details, played_at FROM game_results WHERE user_id = ? ORDER BY played_at DESC, id DESC LIMIT 25').all(userId).map(row => ({ ...row, won: Boolean(row.won), details: JSON.parse(row.details) }));
        return { user, totals, recent };
    }

    leaderboard(gameValue) {
        const game = String(gameValue || '').toLowerCase();
        if (!GAMES.has(game)) throw new Error('Unknown game.');
        return this.database.prepare(`SELECT users.gamertag, ranked.score, ranked.won, ranked.details, ranked.played_at
            FROM game_results ranked JOIN users ON users.id = ranked.user_id
            WHERE ranked.game = ? AND ranked.id = (SELECT best.id FROM game_results best WHERE best.user_id = ranked.user_id AND best.game = ranked.game ORDER BY best.score DESC, best.played_at ASC LIMIT 1)
            ORDER BY ranked.score DESC, ranked.played_at ASC LIMIT 20`).all(game).map(row => ({ ...row, won: Boolean(row.won), details: JSON.parse(row.details) }));
    }
}

module.exports = { Accounts, hashPasscode, verifyPasscode };
