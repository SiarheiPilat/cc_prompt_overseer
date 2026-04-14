import Database from "better-sqlite3";
import path from "node:path";

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const dbPath = process.env.OVERSEER_DB || path.join(process.cwd(), "overseer.db");
  const d = new Database(dbPath);
  d.pragma("journal_mode = WAL");
  d.pragma("synchronous = NORMAL");
  d.pragma("temp_store = MEMORY");
  d.pragma("mmap_size = 268435456");
  migrate(d);
  _db = d;
  return d;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      encoded TEXT,
      cwd TEXT,
      first_seen INTEGER,
      last_seen INTEGER,
      session_count INTEGER DEFAULT 0,
      prompt_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      started_at INTEGER,
      ended_at INTEGER,
      turn_count INTEGER DEFAULT 0,
      entrypoint TEXT,
      version TEXT,
      git_branch TEXT,
      permission_mode TEXT,
      slug TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_slug ON sessions(slug);
    CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);

    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      project_id TEXT,
      ts INTEGER,
      text TEXT,
      char_count INTEGER,
      word_count INTEGER,
      is_slash INTEGER,
      slash_name TEXT,
      slug TEXT,
      prompt_id TEXT,
      parent_uuid TEXT,
      uuid TEXT UNIQUE
    );
    CREATE INDEX IF NOT EXISTS idx_prompts_ts ON prompts(ts);
    CREATE INDEX IF NOT EXISTS idx_prompts_session ON prompts(session_id);
    CREATE INDEX IF NOT EXISTS idx_prompts_project ON prompts(project_id);
    CREATE INDEX IF NOT EXISTS idx_prompts_slash ON prompts(slash_name);
    CREATE INDEX IF NOT EXISTS idx_prompts_slug ON prompts(slug);

    CREATE TABLE IF NOT EXISTS assistant_turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      ts INTEGER,
      text TEXT,
      tool_names TEXT,
      uuid TEXT UNIQUE,
      model TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      stop_reason TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_at_session ON assistant_turns(session_id);
    CREATE INDEX IF NOT EXISTS idx_at_ts ON assistant_turns(ts);

    CREATE TABLE IF NOT EXISTS plans (
      slug TEXT PRIMARY KEY,
      path TEXT,
      title TEXT,
      body TEXT,
      word_count INTEGER,
      mtime INTEGER,
      linked_session_id TEXT
    );

    CREATE TABLE IF NOT EXISTS todos (
      session_id TEXT PRIMARY KEY,
      json TEXT,
      mtime INTEGER
    );

    CREATE TABLE IF NOT EXISTS file_state (
      path TEXT PRIMARY KEY,
      mtime INTEGER,
      size INTEGER,
      last_byte INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_meta (
      uuid TEXT PRIMARY KEY,
      starred INTEGER DEFAULT 0,
      rating INTEGER DEFAULT 0,
      note TEXT,
      hidden INTEGER DEFAULT 0,
      tags TEXT
    );

    CREATE TABLE IF NOT EXISTS tool_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      project_id TEXT,
      turn_uuid TEXT,
      ts INTEGER,
      name TEXT,
      file_path TEXT,
      command TEXT,
      args_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tc_session ON tool_calls(session_id);
    CREATE INDEX IF NOT EXISTS idx_tc_name ON tool_calls(name);
    CREATE INDEX IF NOT EXISTS idx_tc_file ON tool_calls(file_path);
    CREATE INDEX IF NOT EXISTS idx_tc_project ON tool_calls(project_id);

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      query TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_playlists_name ON playlists(name);
  `);

  // Lightweight migrations for older overseer.db files
  const cols = (table: string) => d.prepare(`PRAGMA table_info(${table})`).all() as Array<{name: string}>;
  const hasCol = (table: string, name: string) => cols(table).some(c => c.name === name);
  const tryAdd = (sql: string) => { try { d.exec(sql); } catch {} };
  if (!hasCol("assistant_turns", "model")) tryAdd(`ALTER TABLE assistant_turns ADD COLUMN model TEXT`);
  if (!hasCol("assistant_turns", "input_tokens")) tryAdd(`ALTER TABLE assistant_turns ADD COLUMN input_tokens INTEGER DEFAULT 0`);
  if (!hasCol("assistant_turns", "output_tokens")) tryAdd(`ALTER TABLE assistant_turns ADD COLUMN output_tokens INTEGER DEFAULT 0`);
  if (!hasCol("assistant_turns", "cache_creation_tokens")) tryAdd(`ALTER TABLE assistant_turns ADD COLUMN cache_creation_tokens INTEGER DEFAULT 0`);
  if (!hasCol("assistant_turns", "cache_read_tokens")) tryAdd(`ALTER TABLE assistant_turns ADD COLUMN cache_read_tokens INTEGER DEFAULT 0`);
  if (!hasCol("assistant_turns", "stop_reason")) tryAdd(`ALTER TABLE assistant_turns ADD COLUMN stop_reason TEXT`);
  if (!hasCol("prompts", "category")) tryAdd(`ALTER TABLE prompts ADD COLUMN category TEXT`);
  tryAdd(`CREATE INDEX IF NOT EXISTS idx_at_model ON assistant_turns(model)`);
  tryAdd(`CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category)`);

  // FTS5
  try {
    d.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS prompts_fts USING fts5(
        text,
        content='prompts',
        content_rowid='id',
        tokenize='porter unicode61'
      );
      CREATE TRIGGER IF NOT EXISTS prompts_ai AFTER INSERT ON prompts BEGIN
        INSERT INTO prompts_fts(rowid, text) VALUES (new.id, new.text);
      END;
      CREATE TRIGGER IF NOT EXISTS prompts_ad AFTER DELETE ON prompts BEGIN
        INSERT INTO prompts_fts(prompts_fts, rowid, text) VALUES('delete', old.id, old.text);
      END;
      CREATE TRIGGER IF NOT EXISTS prompts_au AFTER UPDATE ON prompts BEGIN
        INSERT INTO prompts_fts(prompts_fts, rowid, text) VALUES('delete', old.id, old.text);
        INSERT INTO prompts_fts(rowid, text) VALUES (new.id, new.text);
      END;
    `);
  } catch (e) {
    console.warn("[db] FTS5 unavailable:", e);
  }
}

export function setMeta(key: string, value: string) {
  db().prepare("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
}

export function getMeta(key: string): string | null {
  const row = db().prepare("SELECT value FROM meta WHERE key=?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}
