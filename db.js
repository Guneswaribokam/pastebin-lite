import Database from "better-sqlite3";

const db = new Database("pastes.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS pastes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    expires_at INTEGER,
    max_views INTEGER,
    views INTEGER DEFAULT 0
  )
`).run();

export default db;
