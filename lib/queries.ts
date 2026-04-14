import { db } from "./db";

export type PromptRow = {
  id: number;
  uuid: string | null;
  session_id: string;
  project_id: string | null;
  ts: number;
  text: string;           // truncated preview in list contexts; full text when fetched via /api/prompt
  char_count: number;
  word_count: number;
  is_slash: number;
  slash_name: string | null;
  slug: string | null;
  cwd: string | null;
  has_plan: number;
  starred: number;
  rating: number;
  note: string | null;
  tags: string | null;
};

export type PromptQuery = {
  q?: string;
  project?: string;
  slash?: boolean;
  minLen?: number;
  maxLen?: number;
  starred?: boolean;
  hasPlan?: boolean;
  from?: number;
  to?: number;
  category?: string;
  tag?: string;
  permissionMode?: string;
  showHidden?: boolean;
  onlyHidden?: boolean;
  fullText?: boolean;     // return complete p.text instead of a 300-char preview
  orderBy?: "ts" | "char_count" | "session_id" | "interest";
  dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

export function queryPrompts(q: PromptQuery = {}): { rows: PromptRow[]; total: number } {
  const where: string[] = [];
  const params: any[] = [];
  if (q.project) { where.push("p.project_id = ?"); params.push(q.project); }
  if (q.slash) { where.push("p.is_slash = 1"); }
  if (q.minLen != null) { where.push("p.char_count >= ?"); params.push(q.minLen); }
  if (q.maxLen != null) { where.push("p.char_count <= ?"); params.push(q.maxLen); }
  if (q.starred) { where.push("COALESCE(um.starred,0) = 1"); }
  if (q.hasPlan) { where.push("plans.slug IS NOT NULL"); }
  if (q.from) { where.push("p.ts >= ?"); params.push(q.from); }
  if (q.to) { where.push("p.ts <= ?"); params.push(q.to); }
  if (q.category) { where.push("p.category = ?"); params.push(q.category); }
  if (q.tag) { where.push("um.tags LIKE ?"); params.push(`%"${q.tag.replace(/"/g, "")}"%`); }
  if (q.permissionMode) {
    where.push("p.session_id IN (SELECT id FROM sessions WHERE permission_mode = ?)");
    params.push(q.permissionMode);
  }
  if (q.onlyHidden) { where.push("COALESCE(um.hidden,0) = 1"); }
  else if (!q.showHidden) { where.push("COALESCE(um.hidden,0) = 0"); }
  if (q.q && q.q.trim()) {
    where.push("p.id IN (SELECT rowid FROM prompts_fts WHERE prompts_fts MATCH ?)");
    params.push(ftsQuery(q.q));
  }

  const orderCol =
    q.orderBy === "char_count" ? "p.char_count" :
    q.orderBy === "session_id" ? "p.session_id" :
    q.orderBy === "interest" ? "(p.char_count + COALESCE(um.rating,0)*500 + COALESCE(um.starred,0)*300 + (CASE WHEN plans.slug IS NOT NULL THEN 400 ELSE 0 END))" :
    "p.ts";
  const dir = q.dir === "asc" ? "ASC" : "DESC";
  const limit = q.limit ?? 100;
  const offset = q.offset ?? 0;

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  const textSelect = q.fullText ? "p.text AS text" : "substr(p.text, 1, 300) AS text";
  const sql = `
    SELECT p.id, p.uuid, p.session_id, p.project_id, p.ts,
           ${textSelect},
           p.char_count, p.word_count,
           p.is_slash, p.slash_name, p.slug, pr.cwd,
           (CASE WHEN plans.slug IS NOT NULL THEN 1 ELSE 0 END) AS has_plan,
           COALESCE(um.starred,0) AS starred,
           COALESCE(um.rating,0) AS rating,
           um.note AS note,
           um.tags AS tags
    FROM prompts p
    LEFT JOIN projects pr ON pr.id = p.project_id
    LEFT JOIN user_meta um ON um.uuid = p.uuid
    LEFT JOIN plans ON plans.slug = p.slug
    ${whereSql}
    ORDER BY ${orderCol} ${dir}
    LIMIT ? OFFSET ?
  `;
  const rows = db().prepare(sql).all(...params, limit, offset) as PromptRow[];

  const countSql = `
    SELECT COUNT(*) AS n FROM prompts p
    LEFT JOIN user_meta um ON um.uuid = p.uuid
    LEFT JOIN plans ON plans.slug = p.slug
    ${whereSql}
  `;
  const total = (db().prepare(countSql).get(...params) as any).n as number;

  return { rows, total };
}

function ftsQuery(q: string): string {
  // Sanitize: split to tokens, wrap each as prefix match
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 8);
  if (!tokens.length) return "";
  return tokens.map(t => {
    const safe = t.replace(/["*]/g, "");
    return safe ? `"${safe}"*` : "";
  }).filter(Boolean).join(" AND ");
}

export function getPromptFull(id: number): { text: string; char_count: number } | null {
  return db().prepare(`SELECT text, char_count FROM prompts WHERE id=?`).get(id) as any;
}

export function hiddenCount(): number {
  return (db().prepare(`SELECT COUNT(*) n FROM user_meta WHERE hidden=1`).get() as any).n;
}

export function getProjects() {
  return db().prepare(`
    SELECT id, encoded, cwd, first_seen, last_seen, session_count, prompt_count,
      (SELECT COUNT(*) FROM plans pl JOIN sessions s ON s.slug = pl.slug WHERE s.project_id = projects.id) AS plan_count
    FROM projects ORDER BY prompt_count DESC
  `).all();
}

export function getProject(id: string) {
  return db().prepare(`SELECT * FROM projects WHERE id=?`).get(id);
}

export function getAllSessions(opts: {
  sort?: "started" | "prompts" | "cost";
  limit?: number;
  hasPlan?: boolean;
  marathon?: boolean;
  starred?: boolean;
  from?: number;
  to?: number;
  perm?: string;
  tag?: string;
  q?: string;
  project?: string;
} = {}) {
  const D = db();
  const where: string[] = [];
  const params: any[] = [];
  if (opts.project) { where.push("s.project_id = ?"); params.push(opts.project); }
  if (opts.hasPlan) where.push("EXISTS (SELECT 1 FROM plans WHERE plans.slug = s.slug)");
  if (opts.marathon) where.push("(s.ended_at - s.started_at) > (4 * 60 * 60 * 1000)");
  if (opts.starred) where.push("COALESCE(sm.starred, 0) = 1");
  if (opts.from) { where.push("s.started_at >= ?"); params.push(opts.from); }
  if (opts.to) { where.push("s.started_at <= ?"); params.push(opts.to); }
  if (opts.perm) { where.push("s.permission_mode = ?"); params.push(opts.perm); }
  if (opts.tag) { where.push("sm.tags LIKE ?"); params.push(`%"${opts.tag.replace(/"/g, "")}"%`); }
  if (opts.q) {
    where.push("(s.slug LIKE ? OR pr.cwd LIKE ? OR sm.note LIKE ?)");
    const pat = `%${opts.q}%`;
    params.push(pat, pat, pat);
  }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const inner = `
    SELECT s.id, s.slug, s.started_at, s.ended_at, s.turn_count,
      s.permission_mode, pr.cwd,
      (SELECT COUNT(*) FROM prompts WHERE session_id=s.id) AS prompt_count,
      (SELECT slug FROM plans WHERE plans.slug = s.slug) AS plan_slug,
      (SELECT SUM(input_tokens) FROM assistant_turns WHERE session_id=s.id) AS in_tok,
      (SELECT SUM(output_tokens) FROM assistant_turns WHERE session_id=s.id) AS out_tok,
      (SELECT SUM(cache_creation_tokens) FROM assistant_turns WHERE session_id=s.id) AS cw_tok,
      (SELECT SUM(cache_read_tokens) FROM assistant_turns WHERE session_id=s.id) AS cr_tok,
      (SELECT MAX(model) FROM assistant_turns WHERE session_id=s.id) AS model,
      COALESCE(sm.starred, 0) AS starred,
      sm.note AS note
    FROM sessions s
    LEFT JOIN projects pr ON pr.id = s.project_id
    LEFT JOIN session_meta sm ON sm.session_id = s.id
    ${whereSql}
  `;
  const sortCol =
    opts.sort === "prompts" ? "prompt_count" :
    opts.sort === "cost" ? "(COALESCE(out_tok,0) * 75 + COALESCE(in_tok,0) * 15 + COALESCE(cw_tok,0) * 18 + COALESCE(cr_tok,0))" :
    "started_at";
  const sql = `${inner} ORDER BY ${sortCol} DESC LIMIT ?`;
  return D.prepare(sql).all(...params, opts.limit ?? 200) as any[];
}

export function getSessionsForProject(id: string) {
  return db().prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM prompts WHERE session_id=s.id) AS prompt_count,
      (SELECT slug FROM plans WHERE plans.slug=s.slug) AS plan_slug,
      (SELECT SUM(input_tokens) FROM assistant_turns WHERE session_id=s.id) AS in_tok,
      (SELECT SUM(output_tokens) FROM assistant_turns WHERE session_id=s.id) AS out_tok,
      (SELECT SUM(cache_creation_tokens) FROM assistant_turns WHERE session_id=s.id) AS cw_tok,
      (SELECT SUM(cache_read_tokens) FROM assistant_turns WHERE session_id=s.id) AS cr_tok,
      (SELECT MAX(model) FROM assistant_turns WHERE session_id=s.id) AS model
    FROM sessions s WHERE s.project_id=? ORDER BY s.started_at DESC
  `).all(id);
}

export function getSession(id: string) {
  return db().prepare(`SELECT s.*, pr.cwd FROM sessions s LEFT JOIN projects pr ON pr.id=s.project_id WHERE s.id=?`).get(id);
}

export function getAdjacentSessions(id: string): { prev: any | null; next: any | null } {
  const D = db();
  const cur = D.prepare(`SELECT id, project_id, started_at FROM sessions WHERE id=?`).get(id) as any;
  if (!cur || !cur.project_id || !cur.started_at) return { prev: null, next: null };
  const prev = D.prepare(`
    SELECT id, slug, started_at, turn_count
    FROM sessions
    WHERE project_id=? AND started_at IS NOT NULL AND started_at < ?
    ORDER BY started_at DESC LIMIT 1
  `).get(cur.project_id, cur.started_at) as any;
  const next = D.prepare(`
    SELECT id, slug, started_at, turn_count
    FROM sessions
    WHERE project_id=? AND started_at IS NOT NULL AND started_at > ?
    ORDER BY started_at ASC LIMIT 1
  `).get(cur.project_id, cur.started_at) as any;
  return { prev: prev || null, next: next || null };
}

export function getSessionMessages(id: string) {
  const prompts = db().prepare(`
    SELECT p.*, COALESCE(um.starred,0) AS starred, COALESCE(um.rating,0) AS rating
    FROM prompts p LEFT JOIN user_meta um ON um.uuid=p.uuid WHERE session_id=? ORDER BY ts ASC
  `).all(id) as any[];
  const turns = db().prepare(`
    SELECT * FROM assistant_turns WHERE session_id=? ORDER BY ts ASC
  `).all(id) as any[];
  return { prompts, turns };
}

export function getPlans(q?: string) {
  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    return db().prepare(`
      SELECT slug, title, word_count, mtime, linked_session_id, body FROM plans
      WHERE body LIKE ? OR title LIKE ? OR slug LIKE ?
      ORDER BY mtime DESC
    `).all(term, term, term);
  }
  return db().prepare(`SELECT slug, title, word_count, mtime, linked_session_id, body FROM plans ORDER BY mtime DESC`).all();
}

export function getPlan(slug: string) {
  return db().prepare(`SELECT * FROM plans WHERE slug=?`).get(slug);
}

export function getAdjacentPlans(slug: string): { prev: any | null; next: any | null } {
  const D = db();
  const cur = D.prepare(`SELECT slug, mtime FROM plans WHERE slug=?`).get(slug) as any;
  if (!cur || !cur.mtime) return { prev: null, next: null };
  const prev = D.prepare(`
    SELECT slug, title, mtime, word_count FROM plans
    WHERE mtime < ? ORDER BY mtime DESC LIMIT 1
  `).get(cur.mtime) as any;
  const next = D.prepare(`
    SELECT slug, title, mtime, word_count FROM plans
    WHERE mtime > ? ORDER BY mtime ASC LIMIT 1
  `).get(cur.mtime) as any;
  return { prev: prev || null, next: next || null };
}

export function planFollowups(slug: string, sinceMs: number, limit = 30) {
  // Prompts in the linked session that came after the plan was written
  const D = db();
  const ses = D.prepare(`SELECT id FROM sessions WHERE slug=? ORDER BY started_at DESC LIMIT 1`).get(slug) as any;
  if (!ses) return [];
  return D.prepare(`
    SELECT p.id, p.ts, p.session_id, p.is_slash, p.slash_name, p.category,
           p.char_count, substr(p.text, 1, 280) AS snippet
    FROM prompts p
    WHERE p.session_id=? AND p.ts > ?
    ORDER BY p.ts ASC LIMIT ?
  `).all(ses.id, sinceMs, limit) as any[];
}

export function recentEdits(windowMs = 7 * 86400000, limit = 12) {
  const since = Date.now() - windowMs;
  return db().prepare(`
    SELECT file_path, COUNT(*) AS edits, MAX(ts) AS last_ts,
      COUNT(DISTINCT session_id) AS sessions
    FROM tool_calls
    WHERE name IN ('Edit','Write','MultiEdit','NotebookEdit')
      AND file_path IS NOT NULL AND ts >= ?
    GROUP BY file_path ORDER BY edits DESC, last_ts DESC LIMIT ?
  `).all(since, limit) as Array<{ file_path: string; edits: number; last_ts: number; sessions: number }>;
}

export function activeSessions(windowMs = 60 * 60 * 1000) {
  const since = Date.now() - windowMs;
  return db().prepare(`
    SELECT s.id, s.slug, pr.cwd,
      (SELECT MAX(ts) FROM prompts WHERE session_id = s.id) AS last_ts,
      (SELECT COUNT(*) FROM prompts WHERE session_id = s.id AND ts >= ?) AS recent_prompts,
      (SELECT COUNT(*) FROM prompts WHERE session_id = s.id) AS total_prompts
    FROM sessions s LEFT JOIN projects pr ON pr.id = s.project_id
    WHERE EXISTS (SELECT 1 FROM prompts WHERE session_id = s.id AND ts >= ?)
    ORDER BY last_ts DESC LIMIT 8
  `).all(since, since) as any[];
}

export function getDashboardSummary() {
  const D = db();
  const s = {
    prompts: (D.prepare("SELECT COUNT(*) n FROM prompts").get() as any).n,
    sessions: (D.prepare("SELECT COUNT(*) n FROM sessions").get() as any).n,
    projects: (D.prepare("SELECT COUNT(*) n FROM projects").get() as any).n,
    plans: (D.prepare("SELECT COUNT(*) n FROM plans").get() as any).n,
    turns: (D.prepare("SELECT COUNT(*) n FROM assistant_turns").get() as any).n,
    starred: (D.prepare("SELECT COUNT(*) n FROM user_meta WHERE starred=1").get() as any).n,
  };
  const recent = D.prepare(`
    SELECT p.id, p.ts, p.char_count, substr(p.text,1,220) AS snippet, p.session_id, p.slug, pr.cwd
    FROM prompts p LEFT JOIN projects pr ON pr.id=p.project_id
    WHERE p.ts > 0 ORDER BY p.ts DESC LIMIT 10
  `).all();
  const recentPlans = D.prepare(`SELECT slug, title, mtime FROM plans ORDER BY mtime DESC LIMIT 5`).all();
  const topProjects = D.prepare(`SELECT id, cwd, prompt_count FROM projects ORDER BY prompt_count DESC LIMIT 6`).all();
  return { s, recent, recentPlans, topProjects };
}

export function heatmapData() {
  // 7 days of week × 24 hours
  return db().prepare(`
    SELECT CAST(strftime('%w', ts/1000, 'unixepoch') AS INTEGER) AS dow,
           CAST(strftime('%H', ts/1000, 'unixepoch') AS INTEGER) AS hour,
           COUNT(*) AS n
    FROM prompts WHERE ts > 0 GROUP BY dow, hour
  `).all() as Array<{ dow: number; hour: number; n: number }>;
}

export function heatmapTopSessions() {
  const D = db();
  const rows = D.prepare(`
    WITH counts AS (
      SELECT
        CAST(strftime('%w', p.ts/1000, 'unixepoch') AS INTEGER) AS dow,
        CAST(strftime('%H', p.ts/1000, 'unixepoch') AS INTEGER) AS hour,
        p.session_id, COUNT(*) AS n
      FROM prompts p WHERE p.ts > 0
      GROUP BY dow, hour, p.session_id
    ),
    ranked AS (
      SELECT dow, hour, session_id, n,
        ROW_NUMBER() OVER (PARTITION BY dow, hour ORDER BY n DESC) AS rk
      FROM counts
    )
    SELECT r.dow, r.hour, r.session_id, r.n, s.slug
    FROM ranked r LEFT JOIN sessions s ON s.id = r.session_id
    WHERE r.rk <= 3
  `).all() as Array<{ dow: number; hour: number; session_id: string; n: number; slug: string | null }>;
  const map: Record<string, Array<{ session_id: string; slug: string | null; n: number }>> = {};
  for (const r of rows) {
    const key = `${r.dow},${r.hour}`;
    if (!map[key]) map[key] = [];
    map[key].push({ session_id: r.session_id, slug: r.slug, n: r.n });
  }
  return map;
}

export function weeklyCounts() {
  return db().prepare(`
    SELECT strftime('%Y-%W', ts/1000, 'unixepoch') AS wk, COUNT(*) AS n
    FROM prompts WHERE ts > 0 GROUP BY wk ORDER BY wk ASC
  `).all() as Array<{ wk: string; n: number }>;
}

export function slashHistogram() {
  return db().prepare(`
    SELECT slash_name, COUNT(*) AS n FROM prompts WHERE is_slash=1 AND slash_name IS NOT NULL
    GROUP BY slash_name ORDER BY n DESC
  `).all() as Array<{ slash_name: string; n: number }>;
}

export function searchSessions(q: string, limit = 30) {
  if (!q.trim()) return [];
  const term = `%${q.trim()}%`;
  return db().prepare(`
    SELECT s.id, s.slug, s.started_at, s.turn_count,
      pr.cwd, sm.note,
      COALESCE(sm.starred, 0) AS starred,
      (SELECT COUNT(*) FROM prompts WHERE session_id=s.id) AS prompt_count
    FROM sessions s
    LEFT JOIN projects pr ON pr.id = s.project_id
    LEFT JOIN session_meta sm ON sm.session_id = s.id
    WHERE s.slug LIKE ? OR pr.cwd LIKE ? OR sm.note LIKE ? OR sm.tags LIKE ?
    ORDER BY s.started_at DESC LIMIT ?
  `).all(term, term, term, term, limit) as any[];
}

export function searchPlans(q: string, limit = 30) {
  if (!q.trim()) return [];
  const term = `%${q.trim()}%`;
  return db().prepare(`
    SELECT slug, title, mtime, word_count,
      substr(body, MAX(1, instr(LOWER(body), LOWER(?)) - 60), 280) AS snippet
    FROM plans
    WHERE body LIKE ? OR title LIKE ? OR slug LIKE ?
    ORDER BY mtime DESC LIMIT ?
  `).all(q.trim(), term, term, term, limit) as any[];
}

export function searchFTS(q: string, limit = 100) {
  if (!q.trim()) return [];
  const query = q.split(/\s+/).filter(Boolean).slice(0, 8).map(t => {
    const safe = t.replace(/["*]/g, "");
    return safe ? `"${safe}"*` : "";
  }).filter(Boolean).join(" AND ");
  if (!query) return [];
  try {
    return db().prepare(`
      SELECT p.id, p.session_id, p.ts, snippet(prompts_fts, 0, '<b>', '</b>', '…', 12) AS snippet,
             p.slug, pr.cwd, bm25(prompts_fts) AS score, p.char_count
      FROM prompts_fts
      JOIN prompts p ON p.id = prompts_fts.rowid
      LEFT JOIN projects pr ON pr.id = p.project_id
      WHERE prompts_fts MATCH ?
      ORDER BY score ASC
      LIMIT ?
    `).all(query, limit) as any[];
  } catch {
    return [];
  }
}

export function wordCounts(limit = 150) {
  const rows = db().prepare(`SELECT text FROM prompts WHERE char_count > 3 LIMIT 5000`).all() as Array<{text: string}>;
  const stop = new Set([
    "the","a","an","and","or","but","of","to","in","on","for","with","is","it","this","that","as","at","by","be","are","was","were","from","can","not","you","i","we","they","if","so","do","does","did","my","me","our","your","their","has","have","had","get","got","go","see","like","just","some","all","how","what","why","when","where","who","which","than","then","there","here","up","down","out","into","about","over","after","before","off","too","very","more","most","no","yes","use","using","used","one","two","three","any","way","make","sure","also","want","need","should","would","could","might","may","let","lets","think","know","need","make","made","good","bad","new","old","run","ran","tool","tools","code","file","files"
  ]);
  const counts = new Map<string, number>();
  for (const r of rows) {
    const tokens = (r.text || "").toLowerCase().replace(/[^a-z0-9_\-\s/]/g, " ").split(/\s+/);
    for (const t of tokens) {
      if (t.length < 3 || t.length > 20) continue;
      if (stop.has(t)) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return Array.from(counts.entries()).sort((a,b) => b[1]-a[1]).slice(0, limit).map(([w, n]) => ({ w, n }));
}

export function tokenSpend(fromMs: number, toMs: number) {
  const D = db();
  const rows = D.prepare(`
    SELECT model, SUM(input_tokens) AS input, SUM(output_tokens) AS output,
      SUM(cache_creation_tokens) AS cache_creation, SUM(cache_read_tokens) AS cache_read
    FROM assistant_turns WHERE ts >= ? AND ts < ? AND model IS NOT NULL
    GROUP BY model
  `).all(fromMs, toMs) as any[];
  return rows;
}

export function tokenSummary(opts: { from?: number; to?: number } = {}) {
  const D = db();
  const where: string[] = ["model IS NOT NULL"];
  const params: any[] = [];
  if (opts.from != null) { where.push("ts >= ?"); params.push(opts.from); }
  if (opts.to != null) { where.push("ts < ?"); params.push(opts.to); }
  const W = where.join(" AND ");

  const totals = D.prepare(`
    SELECT
      SUM(input_tokens) AS input,
      SUM(output_tokens) AS output,
      SUM(cache_creation_tokens) AS cache_creation,
      SUM(cache_read_tokens) AS cache_read,
      COUNT(*) AS turns
    FROM assistant_turns WHERE ${W}
  `).get(...params) as any;

  const byModel = D.prepare(`
    SELECT model,
      COUNT(*) AS turns,
      SUM(input_tokens) AS input,
      SUM(output_tokens) AS output,
      SUM(cache_creation_tokens) AS cache_creation,
      SUM(cache_read_tokens) AS cache_read
    FROM assistant_turns WHERE ${W}
    GROUP BY model ORDER BY (input + output + cache_creation + cache_read) DESC
  `).all(...params) as any[];

  const projWhere = where.map(w => w.replace(/^model/, "at.model").replace(/^ts/, "at.ts"));
  const byProject = D.prepare(`
    SELECT pr.id, pr.cwd,
      SUM(at.input_tokens) AS input,
      SUM(at.output_tokens) AS output,
      SUM(at.cache_creation_tokens) AS cache_creation,
      SUM(at.cache_read_tokens) AS cache_read,
      COUNT(*) AS turns
    FROM assistant_turns at
    JOIN sessions s ON s.id = at.session_id
    JOIN projects pr ON pr.id = s.project_id
    WHERE ${projWhere.join(" AND ")}
    GROUP BY pr.id ORDER BY (SUM(at.output_tokens) + SUM(at.input_tokens)) DESC LIMIT 30
  `).all(...params) as any[];

  const bySession = D.prepare(`
    SELECT s.id, s.slug, pr.cwd,
      SUM(at.input_tokens) AS input,
      SUM(at.output_tokens) AS output,
      SUM(at.cache_creation_tokens) AS cache_creation,
      SUM(at.cache_read_tokens) AS cache_read,
      MAX(at.model) AS model,
      COUNT(*) AS turns
    FROM assistant_turns at
    JOIN sessions s ON s.id = at.session_id
    LEFT JOIN projects pr ON pr.id = s.project_id
    WHERE ${projWhere.join(" AND ")}
    GROUP BY s.id ORDER BY (SUM(at.output_tokens) + SUM(at.cache_creation_tokens)) DESC LIMIT 30
  `).all(...params) as any[];

  const weekly = D.prepare(`
    SELECT strftime('%Y-%W', ts/1000, 'unixepoch') AS wk,
      SUM(input_tokens) AS input, SUM(output_tokens) AS output,
      SUM(cache_creation_tokens) AS cache_creation, SUM(cache_read_tokens) AS cache_read
    FROM assistant_turns WHERE ts > 0 AND ${W} GROUP BY wk ORDER BY wk
  `).all(...params) as any[];

  const daily = D.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d,
      SUM(input_tokens) AS input, SUM(output_tokens) AS output,
      SUM(cache_creation_tokens) AS cache_creation, SUM(cache_read_tokens) AS cache_read
    FROM assistant_turns WHERE ts > 0 AND ${W} GROUP BY d ORDER BY d DESC LIMIT 30
  `).all(...params) as any[];

  return { totals, byModel, byProject, bySession, weekly, daily };
}

export function toolUsage() {
  const D = db();
  const rows = D.prepare(`
    SELECT tool_names FROM assistant_turns WHERE tool_names IS NOT NULL AND tool_names != ''
  `).all() as Array<{ tool_names: string }>;
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const t of r.tool_names.split(",")) {
      const name = t.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => ({ name, n }));
}

export function categoryBreakdown() {
  return db().prepare(`
    SELECT category, COUNT(*) AS n FROM prompts WHERE category IS NOT NULL GROUP BY category ORDER BY n DESC
  `).all() as Array<{ category: string; n: number }>;
}

export function calendarData(year: number, month: number) {
  // month is 1-12
  const start = Date.UTC(year, month - 1, 1);
  const end = Date.UTC(year, month, 1);
  return db().prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d, COUNT(*) AS n
    FROM prompts WHERE ts >= ? AND ts < ? GROUP BY d
  `).all(start, end) as Array<{ d: string; n: number }>;
}

export function dayDigest(dayStart: number, dayEnd: number) {
  const D = db();
  const counts = D.prepare(`
    SELECT COUNT(*) AS prompts,
      COUNT(DISTINCT session_id) AS sessions,
      SUM(char_count) AS chars
    FROM prompts WHERE ts >= ? AND ts < ?
  `).get(dayStart, dayEnd) as any;
  const tokens = D.prepare(`
    SELECT
      SUM(input_tokens) AS input,
      SUM(output_tokens) AS output,
      SUM(cache_creation_tokens) AS cache_creation,
      SUM(cache_read_tokens) AS cache_read,
      MAX(model) AS model
    FROM assistant_turns WHERE ts >= ? AND ts < ? AND model IS NOT NULL
  `).get(dayStart, dayEnd) as any;
  const sessions = D.prepare(`
    SELECT s.id, s.slug, s.started_at, s.ended_at, pr.cwd,
      (SELECT COUNT(*) FROM prompts WHERE session_id = s.id AND ts >= ? AND ts < ?) AS day_prompts,
      (SELECT MIN(ts) FROM prompts WHERE session_id = s.id AND ts >= ? AND ts < ?) AS first_ts,
      (SELECT MAX(ts) FROM prompts WHERE session_id = s.id AND ts >= ? AND ts < ?) AS last_ts
    FROM sessions s LEFT JOIN projects pr ON pr.id = s.project_id
    WHERE s.id IN (SELECT DISTINCT session_id FROM prompts WHERE ts >= ? AND ts < ?)
    ORDER BY first_ts ASC
  `).all(dayStart, dayEnd, dayStart, dayEnd, dayStart, dayEnd, dayStart, dayEnd) as any[];
  const projects = D.prepare(`
    SELECT pr.id, pr.cwd, COUNT(*) AS prompts
    FROM prompts p JOIN projects pr ON pr.id = p.project_id
    WHERE p.ts >= ? AND p.ts < ? GROUP BY pr.id ORDER BY prompts DESC
  `).all(dayStart, dayEnd) as any[];
  const cats = D.prepare(`
    SELECT category, COUNT(*) AS n FROM prompts WHERE ts >= ? AND ts < ? AND category IS NOT NULL GROUP BY category ORDER BY n DESC
  `).all(dayStart, dayEnd) as any[];
  const plans = D.prepare(`
    SELECT slug, title, mtime FROM plans WHERE mtime >= ? AND mtime < ? ORDER BY mtime DESC
  `).all(dayStart, dayEnd) as any[];
  const recentPrompts = D.prepare(`
    SELECT p.id, p.session_id, p.ts, p.char_count, substr(p.text,1,180) AS snippet, pr.cwd, p.category, p.is_slash, p.slash_name
    FROM prompts p LEFT JOIN projects pr ON pr.id = p.project_id
    WHERE p.ts >= ? AND p.ts < ? ORDER BY p.ts DESC LIMIT 50
  `).all(dayStart, dayEnd) as any[];
  return { counts, tokens, sessions, projects, cats, plans, recentPrompts };
}

export function streakInfo() {
  const days = db().prepare(`
    SELECT DISTINCT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d FROM prompts WHERE ts > 0 ORDER BY d DESC
  `).all() as Array<{ d: string }>;
  const set = new Set(days.map(d => d.d));
  let current = 0, longest = 0, run = 0;
  let prev: string | null = null;
  // longest streak: walk ascending
  const asc = [...days].reverse();
  for (let i = 0; i < asc.length; i++) {
    if (i === 0) run = 1;
    else {
      const a = new Date(asc[i - 1].d + "T00:00:00Z").getTime();
      const b = new Date(asc[i].d + "T00:00:00Z").getTime();
      if (b - a === 86400000) run++;
      else run = 1;
    }
    if (run > longest) longest = run;
  }
  // current streak: walk back from today/yesterday
  const today = new Date().toISOString().slice(0, 10);
  let cursor = today;
  while (set.has(cursor)) {
    current++;
    const d = new Date(cursor + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  if (current === 0) {
    // try from yesterday in case today has no prompts yet
    const y = new Date(today + "T00:00:00Z");
    y.setUTCDate(y.getUTCDate() - 1);
    cursor = y.toISOString().slice(0, 10);
    while (set.has(cursor)) {
      current++;
      const d = new Date(cursor + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      cursor = d.toISOString().slice(0, 10);
    }
  }
  return { current, longest, totalDays: days.length };
}

export function agentInvocations(opts: { project?: string; subagent?: string; limit?: number } = {}) {
  const D = db();
  const where: string[] = ["name = 'Agent'", "args_json IS NOT NULL"];
  const params: any[] = [];
  if (opts.project) { where.push("project_id = ?"); params.push(opts.project); }
  const rows = D.prepare(`
    SELECT id, session_id, project_id, ts, args_json
    FROM tool_calls WHERE ${where.join(" AND ")}
    ORDER BY ts DESC LIMIT ?
  `).all(...params, opts.limit ?? 200) as any[];
  const out: Array<{ id: number; session_id: string; ts: number; subagent: string | null; description: string | null; prompt: string | null }> = [];
  for (const r of rows) {
    let parsed: any = null;
    try { parsed = JSON.parse(r.args_json); } catch {}
    const subagent = parsed?.subagent_type || null;
    if (opts.subagent && subagent !== opts.subagent) continue;
    out.push({
      id: r.id,
      session_id: r.session_id,
      ts: r.ts,
      subagent,
      description: parsed?.description || null,
      prompt: typeof parsed?.prompt === "string" ? parsed.prompt : null,
    });
  }
  return out;
}

export function skillInvocations(opts: { project?: string; skill?: string; limit?: number } = {}) {
  const D = db();
  const where: string[] = ["name = 'Skill'", "args_json IS NOT NULL"];
  const params: any[] = [];
  if (opts.project) { where.push("project_id = ?"); params.push(opts.project); }
  const rows = D.prepare(`
    SELECT id, session_id, project_id, ts, args_json
    FROM tool_calls WHERE ${where.join(" AND ")}
    ORDER BY ts DESC LIMIT ?
  `).all(...params, opts.limit ?? 200) as any[];
  const out: any[] = [];
  for (const r of rows) {
    let parsed: any = null;
    try { parsed = JSON.parse(r.args_json); } catch {}
    const skill = parsed?.skill || null;
    if (opts.skill && skill !== opts.skill) continue;
    out.push({
      id: r.id, session_id: r.session_id, ts: r.ts,
      skill,
      args: parsed?.args || null,
    });
  }
  return out;
}

export function skillCounts(project?: string) {
  const D = db();
  const where: string[] = ["name = 'Skill'", "args_json IS NOT NULL"];
  const params: any[] = [];
  if (project) { where.push("project_id = ?"); params.push(project); }
  const rows = D.prepare(`SELECT args_json, ts FROM tool_calls WHERE ${where.join(" AND ")}`).all(...params) as any[];
  const counts = new Map<string, { n: number; last: number }>();
  for (const r of rows) {
    let s: string = "(unknown)";
    try { s = JSON.parse(r.args_json)?.skill || "(unknown)"; } catch {}
    const cur = counts.get(s) || { n: 0, last: 0 };
    cur.n++;
    if (r.ts > cur.last) cur.last = r.ts;
    counts.set(s, cur);
  }
  return Array.from(counts.entries())
    .map(([skill, v]) => ({ skill, n: v.n, last: v.last }))
    .sort((a, b) => b.n - a.n);
}

export function agentSubtypeCounts(project?: string) {
  const D = db();
  const where: string[] = ["name = 'Agent'", "args_json IS NOT NULL"];
  const params: any[] = [];
  if (project) { where.push("project_id = ?"); params.push(project); }
  const rows = D.prepare(`SELECT args_json, ts FROM tool_calls WHERE ${where.join(" AND ")}`).all(...params) as any[];
  const counts = new Map<string, { n: number; last: number }>();
  for (const r of rows) {
    let s: string = "(unknown)";
    try { s = JSON.parse(r.args_json)?.subagent_type || "(unknown)"; } catch {}
    const cur = counts.get(s) || { n: 0, last: 0 };
    cur.n++;
    if (r.ts > cur.last) cur.last = r.ts;
    counts.set(s, cur);
  }
  return Array.from(counts.entries())
    .map(([subagent, v]) => ({ subagent, n: v.n, last: v.last }))
    .sort((a, b) => b.n - a.n);
}

export function bashCommands(opts: { project?: string; prefix?: string; limit?: number } = {}) {
  const D = db();
  const where: string[] = ["name = 'Bash'", "command IS NOT NULL"];
  const params: any[] = [];
  if (opts.project) { where.push("project_id = ?"); params.push(opts.project); }
  if (opts.prefix) { where.push("command LIKE ?"); params.push(opts.prefix + "%"); }
  const sql = `
    SELECT command, COUNT(*) AS n, MAX(ts) AS last_ts, COUNT(DISTINCT session_id) AS sessions
    FROM tool_calls WHERE ${where.join(" AND ")}
    GROUP BY command ORDER BY n DESC, last_ts DESC LIMIT ?
  `;
  return D.prepare(sql).all(...params, opts.limit ?? 200) as any[];
}

export function bashLeadingWords(project?: string) {
  const D = db();
  const where: string[] = ["name = 'Bash'", "command IS NOT NULL"];
  const params: any[] = [];
  if (project) { where.push("project_id = ?"); params.push(project); }
  const rows = D.prepare(`SELECT command FROM tool_calls WHERE ${where.join(" AND ")}`).all(...params) as Array<{command: string}>;
  const counts = new Map<string, number>();
  for (const r of rows) {
    const cmd = (r.command || "").trim();
    // strip env-var prefixes (FOO=bar BAR=baz cmd) and leading parens / "&&" pipelines
    const m = cmd.match(/^(?:[A-Z_]+=\S+\s+)*([a-zA-Z0-9_\.\/\-]+)/);
    const w = m ? m[1].split("/").pop()! : "(?)";
    if (!w || w.length > 20) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([w, n]) => ({ w, n }));
}

export function slashSuccessMetrics() {
  const D = db();
  const rows = D.prepare(`
    SELECT id, session_id, slash_name, ts FROM prompts
    WHERE is_slash = 1 AND slash_name IS NOT NULL AND ts > 0
    ORDER BY session_id, ts
  `).all() as Array<{ id: number; session_id: string; slash_name: string; ts: number }>;
  const nextRows = D.prepare(`
    SELECT session_id, ts FROM prompts WHERE ts > 0 ORDER BY session_id, ts
  `).all() as Array<{ session_id: string; ts: number }>;

  // Build session -> sorted timestamps for next-prompt lookup
  const bySession = new Map<string, number[]>();
  for (const r of nextRows) {
    const arr = bySession.get(r.session_id);
    if (arr) arr.push(r.ts); else bySession.set(r.session_id, [r.ts]);
  }

  type Acc = { name: string; uses: number; quickFollow: number; gaps: number[]; terminal: number; lastTs: number };
  const acc = new Map<string, Acc>();

  for (const r of rows) {
    const ts = bySession.get(r.session_id) || [];
    // binary search next ts > r.ts
    let lo = 0, hi = ts.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (ts[mid] <= r.ts) lo = mid + 1; else hi = mid;
    }
    const next = ts[lo];
    const a = acc.get(r.slash_name) || { name: r.slash_name, uses: 0, quickFollow: 0, gaps: [], terminal: 0, lastTs: 0 };
    a.uses++;
    if (r.ts > a.lastTs) a.lastTs = r.ts;
    if (next == null) {
      a.terminal++;
    } else {
      const gap = next - r.ts;
      // ignore gaps > 1h (probably session wrapped naturally)
      if (gap < 60 * 60 * 1000) a.gaps.push(gap);
      if (gap < 60 * 1000) a.quickFollow++;
    }
    acc.set(r.slash_name, a);
  }

  const out = Array.from(acc.values()).map(a => {
    const sortedGaps = a.gaps.sort((x, y) => x - y);
    const median = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 0;
    return {
      name: a.name,
      uses: a.uses,
      quick_follow_pct: a.uses ? a.quickFollow / a.uses : 0,
      terminal_pct: a.uses ? a.terminal / a.uses : 0,
      median_gap_ms: median,
      last_ts: a.lastTs,
    };
  }).sort((a, b) => b.uses - a.uses);
  return out;
}

export function tagCounts() {
  const D = db();
  const counts = new Map<string, { prompts: number; sessions: number }>();
  function bump(tag: string, kind: "prompts" | "sessions") {
    const cur = counts.get(tag) || { prompts: 0, sessions: 0 };
    cur[kind]++;
    counts.set(tag, cur);
  }
  for (const r of D.prepare(`SELECT tags FROM user_meta WHERE tags IS NOT NULL`).all() as Array<{ tags: string }>) {
    let arr: any = null;
    try { arr = JSON.parse(r.tags); } catch {}
    if (!Array.isArray(arr)) continue;
    for (const t of arr) {
      if (typeof t !== "string") continue;
      const tag = t.trim().toLowerCase();
      if (tag) bump(tag, "prompts");
    }
  }
  for (const r of D.prepare(`SELECT tags FROM session_meta WHERE tags IS NOT NULL`).all() as Array<{ tags: string }>) {
    let arr: any = null;
    try { arr = JSON.parse(r.tags); } catch {}
    if (!Array.isArray(arr)) continue;
    for (const t of arr) {
      if (typeof t !== "string") continue;
      const tag = t.trim().toLowerCase();
      if (tag) bump(tag, "sessions");
    }
  }
  return Array.from(counts.entries())
    .map(([tag, c]) => ({ tag, n: c.prompts + c.sessions, prompts: c.prompts, sessions: c.sessions }))
    .sort((a, b) => b.n - a.n);
}

export function sessionsByTag(tag: string, limit = 50) {
  const needle = `%"${tag.toLowerCase().replace(/"/g, "")}"%`;
  return db().prepare(`
    SELECT s.id, s.slug, s.started_at, s.turn_count, pr.cwd, sm.note
    FROM session_meta sm
    JOIN sessions s ON s.id = sm.session_id
    LEFT JOIN projects pr ON pr.id = s.project_id
    WHERE sm.tags LIKE ?
    ORDER BY s.started_at DESC LIMIT ?
  `).all(needle, limit) as any[];
}

export function stopReasonStats() {
  return db().prepare(`
    SELECT stop_reason, COUNT(*) AS n FROM assistant_turns
    WHERE stop_reason IS NOT NULL GROUP BY stop_reason ORDER BY n DESC
  `).all() as Array<{ stop_reason: string; n: number }>;
}

export function sessionStopReasons(sessionId: string) {
  return db().prepare(`
    SELECT stop_reason, COUNT(*) AS n FROM assistant_turns
    WHERE session_id=? AND stop_reason IS NOT NULL GROUP BY stop_reason ORDER BY n DESC
  `).all(sessionId) as Array<{ stop_reason: string; n: number }>;
}

export function recentDailyByProject(days = 30): Map<string, number[]> {
  const D = db();
  const since = Date.now() - days * 86400000;
  const rows = D.prepare(`
    SELECT project_id, strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d, COUNT(*) AS n
    FROM prompts WHERE ts >= ? AND project_id IS NOT NULL
    GROUP BY project_id, d
  `).all(since) as Array<{ project_id: string; d: string; n: number }>;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const startMs = today.getTime() - (days - 1) * 86400000;
  const out = new Map<string, number[]>();
  for (const r of rows) {
    const arr = out.get(r.project_id) || new Array(days).fill(0);
    const idx = Math.round((Date.parse(r.d + "T00:00:00Z") - startMs) / 86400000);
    if (idx >= 0 && idx < days) arr[idx] = r.n;
    out.set(r.project_id, arr);
  }
  return out;
}

export function projectLifecycles(limit = 24) {
  const D = db();
  const projects = D.prepare(`
    SELECT id, cwd, prompt_count, first_seen, last_seen FROM projects
    WHERE prompt_count > 0 ORDER BY prompt_count DESC LIMIT ?
  `).all(limit) as any[];
  const out: any[] = [];
  for (const p of projects) {
    const days = D.prepare(`
      SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d, COUNT(*) AS n
      FROM prompts WHERE project_id=? AND ts > 0 GROUP BY d ORDER BY d
    `).all(p.id) as Array<{ d: string; n: number }>;
    if (!days.length) continue;
    const map = new Map(days.map(x => [x.d, x.n]));
    const startMs = Date.parse(days[0].d + "T00:00:00Z");
    const endMs = Date.parse(days[days.length - 1].d + "T00:00:00Z");
    const spanDays = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
    const filled: number[] = [];
    for (let i = 0; i < spanDays; i++) {
      const ds = new Date(startMs + i * 86400000).toISOString().slice(0, 10);
      filled.push(map.get(ds) || 0);
    }
    const ageMs = Date.now() - endMs;
    const status = ageMs < 7 * 86400000 ? "active" : ageMs < 30 * 86400000 ? "recent" : ageMs < 90 * 86400000 ? "cooling" : "dormant";
    out.push({
      id: p.id, cwd: p.cwd, prompt_count: p.prompt_count,
      first_seen: startMs, last_seen: endMs, span_days: spanDays, active_days: days.length,
      status, days: filled,
    });
  }
  return out;
}

export function sessionFiles(sessionId: string) {
  return db().prepare(`
    SELECT file_path,
      SUM(CASE WHEN name IN ('Edit','Write','MultiEdit','NotebookEdit') THEN 1 ELSE 0 END) AS edits,
      SUM(CASE WHEN name = 'Read' THEN 1 ELSE 0 END) AS reads,
      COUNT(*) AS total
    FROM tool_calls WHERE session_id=? AND file_path IS NOT NULL
    GROUP BY file_path ORDER BY total DESC
  `).all(sessionId) as Array<{ file_path: string; edits: number; reads: number; total: number }>;
}

export function sessionToolCounts(sessionId: string) {
  return db().prepare(`
    SELECT name, COUNT(*) AS n FROM tool_calls WHERE session_id=? GROUP BY name ORDER BY n DESC
  `).all(sessionId) as Array<{ name: string; n: number }>;
}

export function invalidateQueryCaches() {
  // no-op; kept as a hook for future query-level caches
}

export function fileUsage(opts: { project?: string; limit?: number } = {}) {
  const D = db();
  const where: string[] = ["file_path IS NOT NULL"];
  const params: any[] = [];
  if (opts.project) { where.push("project_id = ?"); params.push(opts.project); }
  const sql = `
    SELECT file_path,
      SUM(CASE WHEN name IN ('Edit','Write','MultiEdit','NotebookEdit') THEN 1 ELSE 0 END) AS edits,
      SUM(CASE WHEN name = 'Read' THEN 1 ELSE 0 END) AS reads,
      COUNT(*) AS total,
      COUNT(DISTINCT session_id) AS sessions,
      MAX(ts) AS last_ts,
      project_id
    FROM tool_calls
    WHERE ${where.join(" AND ")}
    GROUP BY file_path ORDER BY total DESC LIMIT ?
  `;
  return D.prepare(sql).all(...params, opts.limit ?? 100) as any[];
}

export function promptsMentioningFile(path: string, limit = 25) {
  // Try FTS on the basename first (cheap), then full path as a fallback LIKE.
  const D = db();
  const base = path.replace(/\\/g, "/").split("/").pop() || path;
  const safe = base.replace(/["*]/g, "");
  let rows: any[] = [];
  try {
    rows = D.prepare(`
      SELECT p.id, p.session_id, p.ts, substr(p.text, 1, 280) AS snippet, pr.cwd
      FROM prompts_fts JOIN prompts p ON p.id = prompts_fts.rowid
      LEFT JOIN projects pr ON pr.id = p.project_id
      WHERE prompts_fts MATCH ?
      ORDER BY p.ts DESC LIMIT ?
    `).all(`"${safe}"`, limit) as any[];
  } catch {}
  if (!rows.length) {
    rows = D.prepare(`
      SELECT p.id, p.session_id, p.ts, substr(p.text, 1, 280) AS snippet, pr.cwd
      FROM prompts p LEFT JOIN projects pr ON pr.id = p.project_id
      WHERE p.text LIKE ? ORDER BY p.ts DESC LIMIT ?
    `).all(`%${base}%`, limit) as any[];
  }
  return rows;
}

export function fileDetail(path: string) {
  const D = db();
  const totals = D.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN name IN ('Edit','Write','MultiEdit','NotebookEdit') THEN 1 ELSE 0 END) AS edits,
      SUM(CASE WHEN name = 'Read' THEN 1 ELSE 0 END) AS reads,
      MIN(ts) AS first_ts, MAX(ts) AS last_ts,
      COUNT(DISTINCT session_id) AS session_count
    FROM tool_calls WHERE file_path = ?
  `).get(path) as any;
  const sessions = D.prepare(`
    SELECT tc.session_id, s.slug, s.started_at, s.ended_at, pr.cwd,
      SUM(CASE WHEN tc.name IN ('Edit','Write','MultiEdit','NotebookEdit') THEN 1 ELSE 0 END) AS edits,
      SUM(CASE WHEN tc.name = 'Read' THEN 1 ELSE 0 END) AS reads,
      COUNT(*) AS total,
      MIN(tc.ts) AS first_ts
    FROM tool_calls tc
    LEFT JOIN sessions s ON s.id = tc.session_id
    LEFT JOIN projects pr ON pr.id = s.project_id
    WHERE tc.file_path = ?
    GROUP BY tc.session_id ORDER BY first_ts DESC LIMIT 50
  `).all(path) as any[];
  const days = D.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d, COUNT(*) AS n
    FROM tool_calls WHERE file_path = ? AND ts > 0 GROUP BY d ORDER BY d
  `).all(path) as Array<{ d: string; n: number }>;
  return { totals, sessions, days };
}

export function fileExtCounts() {
  const D = db();
  const rows = D.prepare(`SELECT file_path FROM tool_calls WHERE file_path IS NOT NULL`).all() as Array<{file_path: string}>;
  const counts = new Map<string, number>();
  for (const r of rows) {
    const m = /\.([a-zA-Z0-9]{1,8})$/.exec(r.file_path);
    const ext = m ? m[1].toLowerCase() : "(none)";
    counts.set(ext, (counts.get(ext) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([ext, n]) => ({ ext, n }));
}

export function weekDigest(weekStart: number, weekEnd: number) {
  const D = db();
  const counts = D.prepare(`
    SELECT COUNT(*) AS prompts, COUNT(DISTINCT session_id) AS sessions,
      COUNT(DISTINCT strftime('%Y-%m-%d', ts/1000, 'unixepoch')) AS active_days,
      SUM(char_count) AS chars
    FROM prompts WHERE ts >= ? AND ts < ?
  `).get(weekStart, weekEnd) as any;
  const tokens = D.prepare(`
    SELECT SUM(input_tokens) AS input, SUM(output_tokens) AS output,
      SUM(cache_creation_tokens) AS cache_creation, SUM(cache_read_tokens) AS cache_read,
      COUNT(*) AS turns, MAX(model) AS model
    FROM assistant_turns WHERE ts >= ? AND ts < ? AND model IS NOT NULL
  `).get(weekStart, weekEnd) as any;
  const perDay = D.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d, COUNT(*) AS n
    FROM prompts WHERE ts >= ? AND ts < ? GROUP BY d ORDER BY d ASC
  `).all(weekStart, weekEnd) as Array<{ d: string; n: number }>;
  const topProjects = D.prepare(`
    SELECT pr.id, pr.cwd, COUNT(*) AS prompts
    FROM prompts p JOIN projects pr ON pr.id = p.project_id
    WHERE p.ts >= ? AND p.ts < ? GROUP BY pr.id ORDER BY prompts DESC LIMIT 8
  `).all(weekStart, weekEnd) as any[];
  const cats = D.prepare(`
    SELECT category, COUNT(*) AS n FROM prompts WHERE ts >= ? AND ts < ? AND category IS NOT NULL GROUP BY category ORDER BY n DESC
  `).all(weekStart, weekEnd) as any[];
  const topSessions = D.prepare(`
    SELECT s.id, s.slug, s.started_at, pr.cwd,
      (SELECT COUNT(*) FROM prompts WHERE session_id = s.id AND ts >= ? AND ts < ?) AS week_prompts,
      (SELECT SUM(output_tokens) FROM assistant_turns WHERE session_id = s.id AND ts >= ? AND ts < ?) AS week_out
    FROM sessions s LEFT JOIN projects pr ON pr.id = s.project_id
    WHERE s.id IN (SELECT DISTINCT session_id FROM prompts WHERE ts >= ? AND ts < ?)
    ORDER BY week_prompts DESC LIMIT 10
  `).all(weekStart, weekEnd, weekStart, weekEnd, weekStart, weekEnd) as any[];
  const plans = D.prepare(`
    SELECT slug, title, mtime FROM plans WHERE mtime >= ? AND mtime < ? ORDER BY mtime DESC
  `).all(weekStart, weekEnd) as any[];
  return { counts, tokens, perDay, topProjects, cats, topSessions, plans };
}

export function anomalies() {
  const D = db();

  // Spike days: days > mean + 2*stddev
  const dayRows = D.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d, COUNT(*) AS n
    FROM prompts WHERE ts > 0 GROUP BY d
  `).all() as Array<{ d: string; n: number }>;
  const values = dayRows.map(r => r.n);
  const mean = values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, values.length);
  const sigma = Math.sqrt(variance);
  const spikeThreshold = mean + 2 * sigma;
  const spikeDays = dayRows
    .filter(r => r.n > spikeThreshold)
    .sort((a, b) => b.n - a.n)
    .slice(0, 12)
    .map(r => ({ ...r, deviation: sigma ? (r.n - mean) / sigma : 0 }));

  // Marathon sessions: wall time > 4h
  const marathons = D.prepare(`
    SELECT s.id, s.slug, s.started_at, s.ended_at, s.turn_count, pr.cwd,
      (SELECT SUM(output_tokens) FROM assistant_turns WHERE session_id = s.id) AS out_tok
    FROM sessions s LEFT JOIN projects pr ON pr.id = s.project_id
    WHERE (s.ended_at - s.started_at) > (4 * 60 * 60 * 1000)
      AND s.started_at IS NOT NULL AND s.ended_at IS NOT NULL
    ORDER BY (s.ended_at - s.started_at) DESC LIMIT 15
  `).all() as any[];

  // Debug spirals
  const spirals = D.prepare(`
    SELECT s.id, s.slug, pr.cwd,
      SUM(CASE WHEN p.category IN ('debug','fix') THEN 1 ELSE 0 END) AS debug_count,
      COUNT(*) AS total_count
    FROM prompts p
    JOIN sessions s ON s.id = p.session_id
    LEFT JOIN projects pr ON pr.id = s.project_id
    GROUP BY s.id
    HAVING debug_count > 15
    ORDER BY debug_count DESC LIMIT 15
  `).all() as any[];

  // Low cache hit rate sessions
  const lowCache = D.prepare(`
    SELECT s.id, s.slug, pr.cwd,
      SUM(at.cache_creation_tokens) AS cw,
      SUM(at.cache_read_tokens) AS cr,
      SUM(at.output_tokens) AS out_tok
    FROM assistant_turns at
    JOIN sessions s ON s.id = at.session_id
    LEFT JOIN projects pr ON pr.id = s.project_id
    WHERE at.model IS NOT NULL
    GROUP BY s.id
    HAVING cw > 50000 AND (CAST(cr AS REAL) / NULLIF(cr + cw, 0)) < 0.3
    ORDER BY cw DESC LIMIT 15
  `).all() as any[];

  // Rage prompts: ALL CAPS ≥ 15 chars OR ≥ 3 exclamation marks
  const allPrompts = D.prepare(`
    SELECT p.id, p.session_id, p.ts, p.text, pr.cwd
    FROM prompts p
    LEFT JOIN projects pr ON pr.id = p.project_id
    WHERE p.char_count > 10 AND p.char_count < 1000
  `).all() as any[];
  const rage: any[] = [];
  for (const p of allPrompts) {
    const text = p.text || "";
    const letters = text.replace(/[^A-Za-z]/g, "");
    const allCaps = letters.length >= 15 && letters === letters.toUpperCase() && /[A-Z]/.test(letters);
    const excl = (text.match(/!/g) || []).length;
    if (allCaps || excl >= 3) {
      rage.push({ ...p, excl, allCaps });
      if (rage.length >= 200) break;
    }
  }
  rage.sort((a, b) => b.excl - a.excl);

  return {
    spikeDays, marathons, spirals, lowCache,
    rage: rage.slice(0, 15),
    stats: { mean, sigma, threshold: spikeThreshold, totalDays: dayRows.length },
  };
}

export function projectReport(id: string) {
  const D = db();
  const project = D.prepare(`SELECT * FROM projects WHERE id=?`).get(id) as any;
  if (!project) return null;
  const totals = D.prepare(`
    SELECT COUNT(*) AS prompts, COUNT(DISTINCT session_id) AS sessions,
      MIN(ts) AS first_ts, MAX(ts) AS last_ts,
      SUM(char_count) AS chars
    FROM prompts WHERE project_id=? AND ts > 0
  `).get(id) as any;
  const tokens = D.prepare(`
    SELECT SUM(at.input_tokens) AS input, SUM(at.output_tokens) AS output,
      SUM(at.cache_creation_tokens) AS cache_creation, SUM(at.cache_read_tokens) AS cache_read,
      COUNT(*) AS turns, MAX(at.model) AS model
    FROM assistant_turns at
    JOIN sessions s ON s.id = at.session_id
    WHERE s.project_id=? AND at.model IS NOT NULL
  `).get(id) as any;
  const days = D.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d, COUNT(*) AS n
    FROM prompts WHERE project_id=? AND ts > 0 GROUP BY d ORDER BY d
  `).all(id) as any[];
  const cats = D.prepare(`
    SELECT category, COUNT(*) AS n FROM prompts WHERE project_id=? AND category IS NOT NULL GROUP BY category ORDER BY n DESC
  `).all(id) as any[];
  const slashes = D.prepare(`
    SELECT slash_name, COUNT(*) AS n FROM prompts WHERE project_id=? AND is_slash=1 AND slash_name IS NOT NULL GROUP BY slash_name ORDER BY n DESC LIMIT 15
  `).all(id) as any[];
  const topSessions = D.prepare(`
    SELECT s.id, s.slug, s.started_at, s.turn_count,
      (SELECT SUM(output_tokens) FROM assistant_turns WHERE session_id = s.id) AS out_tok,
      (SELECT slug FROM plans WHERE plans.slug = s.slug) AS plan_slug
    FROM sessions s WHERE s.project_id=? ORDER BY s.turn_count DESC LIMIT 12
  `).all(id) as any[];
  const plans = D.prepare(`
    SELECT p.slug, p.title, p.word_count, p.mtime FROM plans p
    JOIN sessions s ON s.slug = p.slug
    WHERE s.project_id=? GROUP BY p.slug ORDER BY p.mtime DESC
  `).all(id) as any[];
  const heat = D.prepare(`
    SELECT CAST(strftime('%w', ts/1000, 'unixepoch') AS INTEGER) AS dow,
           CAST(strftime('%H', ts/1000, 'unixepoch') AS INTEGER) AS hour,
           COUNT(*) AS n
    FROM prompts WHERE project_id=? AND ts > 0 GROUP BY dow, hour
  `).all(id) as any[];
  return { project, totals, tokens, days, cats, slashes, topSessions, plans, heat };
}

export function sessionStats(id: string) {
  const D = db();
  const s = D.prepare(`SELECT s.*, pr.cwd FROM sessions s LEFT JOIN projects pr ON pr.id=s.project_id WHERE s.id=?`).get(id) as any;
  if (!s) return null;
  const prompts = D.prepare(`
    SELECT id, ts, text, char_count, category, is_slash, slash_name
    FROM prompts WHERE session_id=? ORDER BY ts ASC LIMIT 250
  `).all(id) as any[];
  const tokens = D.prepare(`
    SELECT SUM(input_tokens) AS input, SUM(output_tokens) AS output,
      SUM(cache_creation_tokens) AS cache_creation, SUM(cache_read_tokens) AS cache_read,
      COUNT(*) AS turns, MAX(model) AS model
    FROM assistant_turns WHERE session_id=?
  `).get(id) as any;
  const toolRows = D.prepare(`SELECT tool_names FROM assistant_turns WHERE session_id=? AND tool_names IS NOT NULL AND tool_names != ''`).all(id) as Array<{tool_names: string}>;
  const tools = new Map<string, number>();
  for (const r of toolRows) for (const t of r.tool_names.split(",")) {
    const n = t.trim(); if (n) tools.set(n, (tools.get(n) || 0) + 1);
  }
  const cats = new Map<string, number>();
  for (const p of prompts) { if (p.category) cats.set(p.category, (cats.get(p.category) || 0) + 1); }
  const plan = s.slug ? D.prepare(`SELECT slug, title, word_count FROM plans WHERE slug=?`).get(s.slug) as any : null;
  return { session: s, prompts, tokens, tools: Array.from(tools.entries()).sort((a,b)=>b[1]-a[1]), cats: Array.from(cats.entries()).sort((a,b)=>b[1]-a[1]), plan };
}

export function sessionCandidates() {
  return db().prepare(`
    SELECT s.id, s.slug, s.started_at, s.turn_count, pr.cwd
    FROM sessions s LEFT JOIN projects pr ON pr.id = s.project_id
    WHERE s.turn_count > 2
    ORDER BY s.started_at DESC LIMIT 400
  `).all() as any[];
}

export function starredSessions(limit = 20) {
  return db().prepare(`
    SELECT s.id, s.slug, s.started_at, s.turn_count, s.permission_mode, pr.cwd,
      sm.note,
      (SELECT COUNT(*) FROM prompts WHERE session_id=s.id) AS prompt_count,
      (SELECT SUM(input_tokens) FROM assistant_turns WHERE session_id=s.id) AS in_tok,
      (SELECT SUM(output_tokens) FROM assistant_turns WHERE session_id=s.id) AS out_tok,
      (SELECT SUM(cache_creation_tokens) FROM assistant_turns WHERE session_id=s.id) AS cw_tok,
      (SELECT SUM(cache_read_tokens) FROM assistant_turns WHERE session_id=s.id) AS cr_tok,
      (SELECT MAX(model) FROM assistant_turns WHERE session_id=s.id) AS model
    FROM sessions s
    JOIN session_meta sm ON sm.session_id = s.id
    LEFT JOIN projects pr ON pr.id = s.project_id
    WHERE sm.starred = 1
    ORDER BY s.started_at DESC LIMIT ?
  `).all(limit) as any[];
}

export function highlights() {
  const D = db();
  const starred = D.prepare(`
    SELECT p.id, p.uuid, p.session_id, p.ts, p.char_count, substr(p.text,1,300) AS snippet,
           pr.cwd, um.rating, um.note, p.category, p.slug,
           (CASE WHEN plans.slug IS NOT NULL THEN 1 ELSE 0 END) AS has_plan
    FROM prompts p
    JOIN user_meta um ON um.uuid = p.uuid
    LEFT JOIN projects pr ON pr.id = p.project_id
    LEFT JOIN plans ON plans.slug = p.slug
    WHERE um.starred = 1
    ORDER BY um.rating DESC, p.ts DESC LIMIT 20
  `).all() as any[];

  const highInterest = D.prepare(`
    SELECT p.id, p.uuid, p.session_id, p.ts, p.char_count, substr(p.text,1,300) AS snippet,
           pr.cwd, p.category, p.slug,
           (CASE WHEN plans.slug IS NOT NULL THEN 1 ELSE 0 END) AS has_plan,
           COALESCE(um.starred, 0) AS starred
    FROM prompts p
    LEFT JOIN projects pr ON pr.id = p.project_id
    LEFT JOIN user_meta um ON um.uuid = p.uuid
    LEFT JOIN plans ON plans.slug = p.slug
    WHERE (um.starred IS NULL OR um.starred = 0)
      AND (p.char_count > 400 OR plans.slug IS NOT NULL)
    ORDER BY (p.char_count + (CASE WHEN plans.slug IS NOT NULL THEN 1000 ELSE 0 END)) DESC
    LIMIT 20
  `).all() as any[];

  const sessionsWithPlans = D.prepare(`
    SELECT s.id, s.slug, s.started_at, s.ended_at, s.turn_count, pr.cwd,
      (SELECT SUM(output_tokens) FROM assistant_turns WHERE session_id = s.id) AS out_tok,
      (SELECT title FROM plans WHERE slug = s.slug) AS plan_title,
      (SELECT word_count FROM plans WHERE slug = s.slug) AS plan_words
    FROM sessions s
    LEFT JOIN projects pr ON pr.id = s.project_id
    WHERE s.slug IS NOT NULL AND EXISTS (SELECT 1 FROM plans WHERE slug = s.slug)
    ORDER BY s.turn_count DESC LIMIT 12
  `).all() as any[];

  const signatureByCategory = D.prepare(`
    SELECT p.id, p.uuid, p.session_id, p.ts, p.char_count, substr(p.text,1,220) AS snippet,
           p.category, pr.cwd
    FROM prompts p
    LEFT JOIN projects pr ON pr.id = p.project_id
    WHERE p.category IS NOT NULL AND p.category != 'other' AND p.category != 'short'
      AND p.id IN (
        SELECT MAX(id) FROM prompts WHERE category = p.category GROUP BY category
      )
    ORDER BY p.char_count DESC LIMIT 12
  `).all() as any[];

  // Prompts leading to the longest single assistant response
  const bigAnswers = D.prepare(`
    SELECT at.session_id, at.ts, at.output_tokens, at.model, pr.cwd,
      (SELECT substr(text, 1, 240) FROM prompts WHERE session_id = at.session_id AND ts <= at.ts ORDER BY ts DESC LIMIT 1) AS prompt_snippet,
      (SELECT id FROM prompts WHERE session_id = at.session_id AND ts <= at.ts ORDER BY ts DESC LIMIT 1) AS prompt_id
    FROM assistant_turns at
    JOIN sessions s ON s.id = at.session_id
    LEFT JOIN projects pr ON pr.id = s.project_id
    WHERE at.output_tokens > 0
    ORDER BY at.output_tokens DESC LIMIT 10
  `).all() as any[];

  return { starred, highInterest, sessionsWithPlans, signatureByCategory, bigAnswers };
}

export function graphData() {
  const projects = db().prepare(`SELECT id, cwd, prompt_count FROM projects WHERE prompt_count > 0`).all() as any[];
  const sessions = db().prepare(`SELECT id, project_id, slug, turn_count FROM sessions WHERE turn_count > 2`).all() as any[];
  const plans = db().prepare(`SELECT slug, title FROM plans`).all() as any[];
  return { projects, sessions, plans };
}
