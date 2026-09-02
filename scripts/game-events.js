'use strict';

(function attachArcadeEvents(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = { createArcadeEvents: factory };
    if (root?.document) root.ArcadeEvents = factory(root);
})(typeof window === 'undefined' ? null : window, function createArcadeEvents(root = {}) {
    const TYPE_PATTERN = /^[a-z][a-z0-9]*(?::[a-z][a-z0-9-]*)+$/;
    const GAME_NAMES = Object.freeze({ pong: 'pong', Sudoku: 'sudoku', Minesweeper: 'minesweeper', tictactoe: 'tictactoe', 'battle-tanks': 'battletanks', tetris: 'tetris' });
    const pathGame = root.location?.pathname?.match(/\/(pong|Sudoku|Minesweeper|tictactoe|battle-tanks|tetris)\//)?.[1];
    const pageGame = GAME_NAMES[pathGame] || null;
    const listeners = new Map();
    let sequence = 0;

    const report = error => {
        try { root.console?.error?.('Arcade event listener failed.', error); } catch { /* Event delivery must not interrupt gameplay. */ }
    };
    const remove = (type, entry) => {
        const entries = listeners.get(type);
        if (!entries) return;
        entries.delete(entry);
        if (!entries.size) listeners.delete(type);
    };
    const on = (type, listener, options = {}) => {
        if (type !== '*' && !TYPE_PATTERN.test(type)) throw new TypeError(`Invalid arcade event type: ${type}`);
        if (typeof listener !== 'function') throw new TypeError('Arcade event listeners must be functions.');
        const entry = { listener, once: Boolean(options.once) };
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(entry);
        const off = () => remove(type, entry);
        if (options.signal) {
            if (options.signal.aborted) off();
            else options.signal.addEventListener('abort', off, { once: true });
        }
        return off;
    };
    const emit = (type, detail = {}, options = {}) => {
        if (!TYPE_PATTERN.test(type)) throw new TypeError(`Invalid arcade event type: ${type}`);
        if (!detail || typeof detail !== 'object' || Array.isArray(detail)) throw new TypeError('Arcade event detail must be an object.');
        const event = Object.freeze({
            version: 1,
            id: ++sequence,
            type,
            game: options.game === undefined ? pageGame : options.game,
            source: options.source || 'client',
            timestamp: root.performance?.now?.() ?? Date.now(),
            detail: Object.freeze({ ...detail })
        });
        const entries = [...(listeners.get(type) || []), ...(listeners.get('*') || [])];
        entries.forEach(entry => {
            try { entry.listener(event); } catch (error) { report(error); }
            if (entry.once) { remove(type, entry); remove('*', entry); }
        });
        return event;
    };
    const api = { version: 1, game: pageGame, emit, on, once: (type, listener, options = {}) => on(type, listener, { ...options, once: true }) };
    return Object.freeze(api);
});
