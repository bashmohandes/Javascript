CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    gamertag TEXT NOT NULL COLLATE NOCASE UNIQUE,
    passcode_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_results (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game TEXT NOT NULL CHECK (game IN ('pong', 'sudoku', 'minesweeper')),
    score INTEGER NOT NULL CHECK (score >= 0),
    won INTEGER NOT NULL CHECK (won IN (0, 1)),
    details TEXT NOT NULL DEFAULT '{}',
    played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX game_results_user_played ON game_results(user_id, played_at DESC);
CREATE INDEX game_results_leaderboard ON game_results(game, score DESC, played_at ASC);
CREATE INDEX sessions_expiry ON sessions(expires_at);
