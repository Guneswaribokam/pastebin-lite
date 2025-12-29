const Database = require("better-sqlite3");
const db = new Database("pastes.db");
db.prepare(`
  CREATE TABLE IF NOT EXISTS pastes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    max_views INTEGER,
    views INTEGER NOT NULL DEFAULT 0
  )
`).run();
module.exports = db;
