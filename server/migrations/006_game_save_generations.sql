ALTER TABLE game_saves RENAME TO game_saves_legacy;

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
    generation TEXT NOT NULL CHECK (length(generation) = 32 AND generation NOT GLOB '*[^0-9a-f]*'),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, game, slot),
    UNIQUE (generation)
);

INSERT INTO game_saves (
    id, user_id, game, slot, title, mode, state_version, state_json,
    elapsed_seconds, score_label, screenshot, screenshot_mime, generation,
    revision, created_at, updated_at
)
SELECT
    id, user_id, game, slot, title, mode, state_version, state_json,
    elapsed_seconds, score_label, screenshot, screenshot_mime,
    lower(hex(randomblob(16))), revision, created_at, updated_at
FROM game_saves_legacy;

DROP TABLE game_saves_legacy;
CREATE INDEX game_saves_user_game ON game_saves(user_id, game, slot);
