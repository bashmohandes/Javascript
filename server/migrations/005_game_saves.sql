CREATE TABLE game_saves (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game TEXT NOT NULL CHECK (game IN ('pong','sudoku','minesweeper','tictactoe','battletanks','tetris')),
    slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
    title TEXT,
    mode TEXT NOT NULL,
    state_version INTEGER NOT NULL CHECK (state_version > 0),
    state_json TEXT NOT NULL,
    elapsed_seconds INTEGER NOT NULL CHECK (elapsed_seconds >= 0),
    score_label TEXT,
    screenshot BLOB NOT NULL,
    screenshot_mime TEXT NOT NULL CHECK (screenshot_mime IN ('image/jpeg','image/png','image/webp')),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, game, slot)
);

CREATE INDEX game_saves_user_game ON game_saves(user_id, game, slot);
