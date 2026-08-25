PRAGMA foreign_keys = OFF;
CREATE TABLE game_results_new (id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,game TEXT NOT NULL CHECK (game IN ('pong','sudoku','minesweeper','tictactoe','battletanks','tetris')),score INTEGER NOT NULL CHECK (score >= 0),won INTEGER NOT NULL CHECK (won IN (0,1)),details TEXT NOT NULL DEFAULT '{}',played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO game_results_new SELECT * FROM game_results;
DROP TABLE game_results;
ALTER TABLE game_results_new RENAME TO game_results;
CREATE INDEX idx_results_user_time ON game_results(user_id, played_at DESC);
CREATE INDEX idx_results_game_score ON game_results(game, score DESC, played_at ASC);
PRAGMA foreign_keys = ON;
