'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function openDatabase(filename = process.env.DATABASE_PATH || path.resolve(__dirname, '..', 'data', 'arcade.sqlite')) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const database = new DatabaseSync(filename);
    database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    const migrationDirectory = path.join(__dirname, 'migrations');
    const applied = database.prepare('SELECT version FROM schema_migrations').all().map(row => row.version);
    for (const version of fs.readdirSync(migrationDirectory).filter(file => file.endsWith('.sql')).sort()) {
        if (applied.includes(version)) continue;
        const sql = fs.readFileSync(path.join(migrationDirectory, version), 'utf8');
        database.exec('BEGIN IMMEDIATE');
        try {
            database.exec(sql);
            database.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
            database.exec('COMMIT');
        } catch (error) {
            database.exec('ROLLBACK');
            throw new Error(`Migration ${version} failed: ${error.message}`);
        }
    }
    return database;
}

module.exports = { openDatabase };
