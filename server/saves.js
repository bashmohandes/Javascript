'use strict';

const { randomBytes } = require('node:crypto');

const GAMES = new Set(['pong', 'sudoku', 'minesweeper', 'tictactoe', 'battletanks', 'tetris']);
const MODES = Object.freeze({
    pong: new Set(['solo', 'duo']),
    sudoku: new Set(['easy', 'medium', 'hard']),
    minesweeper: new Set(['easy', 'medium', 'hard']),
    tictactoe: new Set(['solo-easy', 'solo-medium', 'solo-hard', 'duo']),
    battletanks: new Set(['solo', 'local']),
    tetris: new Set(['marathon'])
});
const MAX_STATE_BYTES = 256 * 1024;
const MAX_SCREENSHOT_BYTES = 256 * 1024;

class SaveError extends Error {
    constructor(message, status = 400, code = 'INVALID_SAVE', current = null) {
        super(message); this.status = status; this.code = code; this.current = current;
    }
}

function text(value, maximum, label, optional = false) {
    const normalized = String(value ?? '').trim();
    if (!normalized && optional) return null;
    if (!normalized || normalized.length > maximum) throw new SaveError(`${label} must be ${optional ? `at most ${maximum}` : `1–${maximum}`} characters.`);
    return normalized;
}
function integer(value, minimum, maximum, label) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < minimum || number > maximum) throw new SaveError(`Invalid ${label}.`);
    return number;
}
function gameId(value) {
    const game = String(value || '').toLowerCase();
    if (!GAMES.has(game)) throw new SaveError('Unknown game.');
    return game;
}
function slotNumber(value) { return integer(value, 1, 5, 'save slot'); }
function saveGeneration(value) { return String(value || ''); }
function timestamp(value) { return value ? `${String(value).replace(' ', 'T')}Z` : null; }
function imageFrom(payload) {
    const mimeType = String(payload?.mimeType || '').toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) || typeof payload?.data !== 'string') throw new SaveError('Invalid save screenshot.');
    let data;
    try { data = Buffer.from(payload.data, 'base64'); } catch { throw new SaveError('Invalid save screenshot.'); }
    if (!data.length || data.length > MAX_SCREENSHOT_BYTES) throw new SaveError('Save screenshot is too large.');
    const valid = mimeType === 'image/png' ? data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : mimeType === 'image/jpeg' ? data[0] === 0xff && data[1] === 0xd8 && data.at(-2) === 0xff && data.at(-1) === 0xd9
            : data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP';
    if (!valid) throw new SaveError('Invalid save screenshot.');
    return { mimeType, data };
}
function validatePayload(game, payload, { stateRequired = true } = {}) {
    const title = text(payload?.title, 60, 'Save title', true);
    if (!stateRequired) return { title };
    const mode = text(payload?.mode, 24, 'Save mode');
    if (!MODES[game].has(mode)) throw new SaveError('Invalid save mode.');
    const stateVersion = integer(payload?.stateVersion, 1, 1000, 'save state version');
    if (!payload?.state || typeof payload.state !== 'object' || Array.isArray(payload.state)) throw new SaveError('Invalid save state.');
    const stateJson = JSON.stringify(payload.state);
    if (Buffer.byteLength(stateJson) > MAX_STATE_BYTES) throw new SaveError('Save state is too large.');
    const elapsedSeconds = integer(payload.elapsedSeconds, 0, 8640000, 'elapsed time');
    const scoreLabel = text(payload.scoreLabel, 64, 'Score label', true);
    const screenshot = imageFrom(payload.screenshot);
    return { title, mode, stateVersion, stateJson, elapsedSeconds, scoreLabel, ...screenshot };
}
function summary(row) {
    if (!row) return null;
    return {
        slot: row.slot, game: row.game, title: row.title, mode: row.mode, stateVersion: row.state_version,
        elapsedSeconds: row.elapsed_seconds, scoreLabel: row.score_label, generation: row.generation, revision: row.revision,
        createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at),
        screenshotUrl: `/api/saves/${row.game}/${row.slot}/screenshot?g=${row.generation}&v=${row.revision}`
    };
}

class GameSaves {
    constructor(database) { this.database = database; }
    row(userId, game, slot) { return this.database.prepare('SELECT * FROM game_saves WHERE user_id = ? AND game = ? AND slot = ?').get(userId, game, slot); }
    list(userId, gameValue) {
        const game = gameId(gameValue);
        return this.database.prepare('SELECT * FROM game_saves WHERE user_id = ? AND game = ? ORDER BY slot').all(userId, game).map(summary);
    }
    load(userId, gameValue, slotValue) {
        const game = gameId(gameValue), slot = slotNumber(slotValue), row = this.row(userId, game, slot);
        if (!row) throw new SaveError('Save slot not found.', 404, 'SAVE_NOT_FOUND');
        let state;
        try { state = JSON.parse(row.state_json); } catch { throw new SaveError('This save is damaged and cannot be loaded.', 409, 'SAVE_DAMAGED'); }
        return { ...summary(row), state };
    }
    screenshot(userId, gameValue, slotValue) {
        const game = gameId(gameValue), slot = slotNumber(slotValue), row = this.row(userId, game, slot);
        if (!row) throw new SaveError('Save screenshot not found.', 404, 'SAVE_NOT_FOUND');
        return { data: Buffer.from(row.screenshot), mimeType: row.screenshot_mime };
    }
    create(userId, gameValue, payload) {
        const game = gameId(gameValue), values = validatePayload(game, payload);
        this.database.exec('BEGIN IMMEDIATE');
        try {
            const occupied = new Set(this.database.prepare('SELECT slot FROM game_saves WHERE user_id = ? AND game = ?').all(userId, game).map(row => row.slot));
            const slot = [1,2,3,4,5].find(candidate => !occupied.has(candidate));
            if (!slot) throw new SaveError('All five save slots are occupied.', 409, 'SAVE_SLOTS_FULL');
            this.database.prepare(`INSERT INTO game_saves
                (user_id, game, slot, title, mode, state_version, state_json, elapsed_seconds, score_label, screenshot, screenshot_mime, generation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, game, slot, values.title, values.mode, values.stateVersion, values.stateJson, values.elapsedSeconds, values.scoreLabel, values.data, values.mimeType, randomBytes(16).toString('hex'));
            this.database.exec('COMMIT');
            return summary(this.row(userId, game, slot));
        } catch (error) {
            if (this.database.isTransaction) this.database.exec('ROLLBACK');
            throw error;
        }
    }
    update(userId, gameValue, slotValue, payload) {
        const game = gameId(gameValue), slot = slotNumber(slotValue), values = validatePayload(game, payload);
        const current = this.row(userId, game, slot);
        if (!current) throw new SaveError('Save slot not found.', 404, 'SAVE_NOT_FOUND');
        const revision = integer(payload.expectedRevision, 1, Number.MAX_SAFE_INTEGER, 'save revision'), generation = saveGeneration(payload.expectedGeneration);
        if (revision !== current.revision || generation !== current.generation) throw new SaveError('This save changed on another device.', 409, 'SAVE_CONFLICT', summary(current));
        const result = this.database.prepare(`UPDATE game_saves SET title = ?, mode = ?, state_version = ?, state_json = ?, elapsed_seconds = ?, score_label = ?, screenshot = ?, screenshot_mime = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND game = ? AND slot = ? AND generation = ? AND revision = ?`).run(values.title, values.mode, values.stateVersion, values.stateJson, values.elapsedSeconds, values.scoreLabel, values.data, values.mimeType, userId, game, slot, generation, revision);
        if (!result.changes) throw new SaveError('This save changed on another device.', 409, 'SAVE_CONFLICT', summary(this.row(userId, game, slot)));
        return summary(this.row(userId, game, slot));
    }
    rename(userId, gameValue, slotValue, payload) {
        const game = gameId(gameValue), slot = slotNumber(slotValue), { title } = validatePayload(game, payload, { stateRequired: false });
        const current = this.row(userId, game, slot);
        if (!current) throw new SaveError('Save slot not found.', 404, 'SAVE_NOT_FOUND');
        const revision = integer(payload.expectedRevision, 1, Number.MAX_SAFE_INTEGER, 'save revision'), generation = saveGeneration(payload.expectedGeneration);
        if (revision !== current.revision || generation !== current.generation) throw new SaveError('This save changed on another device.', 409, 'SAVE_CONFLICT', summary(current));
        const result = this.database.prepare('UPDATE game_saves SET title = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND generation = ? AND revision = ?').run(title, current.id, generation, revision);
        if (!result.changes) throw new SaveError('This save changed on another device.', 409, 'SAVE_CONFLICT', summary(this.row(userId, game, slot)));
        return summary(this.row(userId, game, slot));
    }
    delete(userId, gameValue, slotValue, expectedRevision, expectedGeneration) {
        const game = gameId(gameValue), slot = slotNumber(slotValue), current = this.row(userId, game, slot);
        if (!current) throw new SaveError('Save slot not found.', 404, 'SAVE_NOT_FOUND');
        const revision = integer(expectedRevision, 1, Number.MAX_SAFE_INTEGER, 'save revision'), generation = saveGeneration(expectedGeneration);
        if (revision !== current.revision || generation !== current.generation) throw new SaveError('This save changed on another device.', 409, 'SAVE_CONFLICT', summary(current));
        const result = this.database.prepare('DELETE FROM game_saves WHERE id = ? AND generation = ? AND revision = ?').run(current.id, generation, revision);
        if (!result.changes) throw new SaveError('This save changed on another device.', 409, 'SAVE_CONFLICT', summary(this.row(userId, game, slot)));
        return { ok: true };
    }
}

module.exports = { GameSaves, SaveError, MAX_SCREENSHOT_BYTES, MAX_STATE_BYTES };
