PRAGMA foreign_keys = OFF;
CREATE TABLE game_results_new (id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,game TEXT NOT NULL CHECK (game IN ('pong','sudoku','minesweeper','tictactoe')),score INTEGER NOT NULL CHECK (score >= 0),won INTEGER NOT NULL CHECK (won IN (0,1)),details TEXT NOT NULL DEFAULT '{}',played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO game_results_new SELECT * FROM game_results;
DROP TABLE game_results;
ALTER TABLE game_results_new RENAME TO game_results;
CREATE INDEX game_results_user_played ON game_results(user_id,played_at DESC);
CREATE INDEX game_results_leaderboard ON game_results(game,score DESC,played_at ASC);
PRAGMA foreign_keys = ON;
