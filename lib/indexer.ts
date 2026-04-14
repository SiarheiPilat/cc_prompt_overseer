import fs from "node:fs";
import path from "node:path";
import { db, setMeta, getMeta } from "./db";
import { paths, safeReadDir, cwdFromSessionFile } from "./claude-paths";
import { streamLines, safeParse } from "./parse-jsonl";
import { categorize } from "./categorize";

const SCHEMA_VERSION = "3"; // bump when fields added; forces reindex

type FileState = { path: string; mtime: number; size: number; last_byte: number };

export type IndexStats = {
  scannedFiles: number;
  changedFiles: number;
  newPrompts: number;
  newAssistantTurns: number;
  projects: number;
  plans: number;
  durationMs: number;
};

function getFileState(p: string): FileState | null {
  return db().prepare("SELECT path,mtime,size,last_byte FROM file_state WHERE path=?").get(p) as any;
}

function setFileState(p: string, mtime: number, size: number, last_byte: number) {
  db().prepare(`
    INSERT INTO file_state(path,mtime,size,last_byte)
    VALUES(?,?,?,?)
    ON CONFLICT(path) DO UPDATE SET mtime=excluded.mtime, size=excluded.size, last_byte=excluded.last_byte
  `).run(p, mtime, size, last_byte);
}

function toTs(s: string | undefined): number {
  if (!s) return 0;
  const n = Date.parse(s);
  return isNaN(n) ? 0 : n;
}

function extractUserText(content: any): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    // Skip tool_result-only entries; keep text blocks if any
    const texts: string[] = [];
    for (const c of content) {
      if (c && typeof c === "object" && c.type === "text" && typeof c.text === "string") {
        texts.push(c.text);
      }
    }
    return texts.length ? texts.join("\n") : null;
  }
  return null;
}

function extractAssistantText(content: any): { text: string; toolNames: string[]; toolCalls: Array<{ name: string; input: any }> } {
  const texts: string[] = [];
  const tools: string[] = [];
  const calls: Array<{ name: string; input: any }> = [];
  if (typeof content === "string") return { text: content, toolNames: [], toolCalls: [] };
  if (Array.isArray(content)) {
    for (const c of content) {
      if (!c || typeof c !== "object") continue;
      if (c.type === "text" && typeof c.text === "string") texts.push(c.text);
      else if (c.type === "tool_use" && typeof c.name === "string") {
        tools.push(c.name);
        calls.push({ name: c.name, input: c.input });
      }
    }
  }
  return { text: texts.join("\n"), toolNames: tools, toolCalls: calls };
}

function extractFilePath(name: string, input: any): string | null {
  if (!input || typeof input !== "object") return null;
  for (const k of ["file_path", "path", "notebook_path", "filePath"]) {
    if (typeof input[k] === "string" && input[k].length < 800) return input[k];
  }
  return null;
}

function extractCommand(name: string, input: any): string | null {
  if (!input || typeof input !== "object") return null;
  if (name === "Bash" && typeof input.command === "string") return input.command.slice(0, 1000);
  return null;
}

function detectSlash(text: string): { is: boolean; name: string | null } {
  const m = text.match(/^\s*\/([a-zA-Z0-9_\-:.]{1,80})(\s|$)/);
  if (m) return { is: true, name: m[1] };
  return { is: false, name: null };
}

function projectIdFromEncoded(encoded: string): string {
  return encoded;
}

export function indexAll(opts: { verbose?: boolean; force?: boolean } = {}): IndexStats {
  const start = Date.now();
  const stats: IndexStats = {
    scannedFiles: 0, changedFiles: 0, newPrompts: 0, newAssistantTurns: 0,
    projects: 0, plans: 0, durationMs: 0,
  };
  const D = db();
  // Force full reindex when schema version changed
  const stored = getMeta("schema_version");
  if (stored !== SCHEMA_VERSION || opts.force) {
    D.exec(`DELETE FROM file_state; DELETE FROM prompts; DELETE FROM assistant_turns; DELETE FROM tool_calls;`);
    setMeta("schema_version", SCHEMA_VERSION);
  }

  const projRoot = paths.projects();
  const projDirs = safeReadDir(projRoot).filter(n => {
    try { return fs.statSync(path.join(projRoot, n)).isDirectory(); } catch { return false; }
  });
  stats.projects = projDirs.length;

  const upsertProject = D.prepare(`
    INSERT INTO projects(id,encoded,cwd,first_seen,last_seen,session_count,prompt_count)
    VALUES(?,?,?,?,?,0,0)
    ON CONFLICT(id) DO UPDATE SET cwd=COALESCE(excluded.cwd, projects.cwd),
      first_seen=MIN(projects.first_seen, excluded.first_seen),
      last_seen=MAX(projects.last_seen, excluded.last_seen)
  `);
  const upsertSession = D.prepare(`
    INSERT INTO sessions(id,project_id,started_at,ended_at,turn_count,entrypoint,version,git_branch,permission_mode,slug)
    VALUES(?,?,?,?,0,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      project_id=COALESCE(sessions.project_id, excluded.project_id),
      started_at=MIN(COALESCE(sessions.started_at, excluded.started_at), excluded.started_at),
      ended_at=MAX(COALESCE(sessions.ended_at, 0), excluded.ended_at),
      entrypoint=COALESCE(excluded.entrypoint, sessions.entrypoint),
      version=COALESCE(excluded.version, sessions.version),
      git_branch=COALESCE(excluded.git_branch, sessions.git_branch),
      permission_mode=COALESCE(excluded.permission_mode, sessions.permission_mode),
      slug=COALESCE(excluded.slug, sessions.slug)
  `);
  const insertPrompt = D.prepare(`
    INSERT OR IGNORE INTO prompts(session_id,project_id,ts,text,char_count,word_count,is_slash,slash_name,slug,prompt_id,parent_uuid,uuid,category)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insertAssistant = D.prepare(`
    INSERT OR IGNORE INTO assistant_turns(session_id,ts,text,tool_names,uuid,model,input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens,stop_reason)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insertToolCall = D.prepare(`
    INSERT INTO tool_calls(session_id, project_id, turn_uuid, ts, name, file_path, command, args_json)
    VALUES(?,?,?,?,?,?,?,?)
  `);

  const tx = D.transaction((jobs: Array<() => void>) => { for (const j of jobs) j(); });

  for (const pdir of projDirs) {
    const full = path.join(projRoot, pdir);
    const files = safeReadDir(full).filter(f => f.endsWith(".jsonl"));
    if (!files.length) continue;
    // derive cwd from the first file
    let cwd: string | null = null;
    for (const f of files) { cwd = cwdFromSessionFile(path.join(full, f)); if (cwd) break; }
    const pid = projectIdFromEncoded(pdir);
    const now = Date.now();
    upsertProject.run(pid, pdir, cwd, now, now);

    for (const f of files) {
      const fp = path.join(full, f);
      stats.scannedFiles++;
      let st: fs.Stats;
      try { st = fs.statSync(fp); } catch { continue; }
      const prev = getFileState(fp);
      const startByte = prev && prev.size <= st.size && prev.mtime === st.mtimeMs ? st.size : (prev && prev.size < st.size ? prev.last_byte : 0);
      if (prev && prev.size === st.size && prev.mtime === st.mtimeMs) continue;
      stats.changedFiles++;

      const sessionId = path.basename(f, ".jsonl");
      const jobs: Array<() => void> = [];
      let sessionMeta = {
        started_at: 0, ended_at: 0, entrypoint: "" as string | null,
        version: "" as string | null, git_branch: "" as string | null,
        permission_mode: "" as string | null, slug: "" as string | null,
        pidFromCwd: pid,
      };

      const newLastByte = streamLines(fp, startByte, (raw, _s, _e) => {
        const obj = safeParse<any>(raw);
        if (!obj) return;
        const ts = toTs(obj.timestamp);
        if (ts) {
          if (!sessionMeta.started_at || ts < sessionMeta.started_at) sessionMeta.started_at = ts;
          if (ts > sessionMeta.ended_at) sessionMeta.ended_at = ts;
        }
        if (obj.entrypoint) sessionMeta.entrypoint = obj.entrypoint;
        if (obj.version) sessionMeta.version = obj.version;
        if (obj.gitBranch) sessionMeta.git_branch = obj.gitBranch;
        if (obj.permissionMode) sessionMeta.permission_mode = obj.permissionMode;
        if (obj.slug) sessionMeta.slug = obj.slug;

        if (obj.type === "user" && obj.message && obj.message.content !== undefined) {
          // Skip sidechain user messages with tool_result content — not human input
          const text = extractUserText(obj.message.content);
          if (text && !obj.isSidechain) {
            const slash = detectSlash(text);
            const wc = text.trim().length ? text.trim().split(/\s+/).length : 0;
            const cat = categorize(text);
            jobs.push(() => {
              const info = insertPrompt.run(
                sessionId, pid, ts, text, text.length, wc,
                slash.is ? 1 : 0, slash.name, obj.slug || null,
                obj.promptId || null, obj.parentUuid || null, obj.uuid || null,
                cat
              );
              if (info.changes > 0) stats.newPrompts++;
            });
          }
        } else if (obj.type === "assistant" && obj.message && obj.message.content !== undefined) {
          const a = extractAssistantText(obj.message.content);
          const u = obj.message?.usage || {};
          const model = obj.message?.model || null;
          const stop = obj.message?.stop_reason || null;
          if (a.text || a.toolNames.length || u.output_tokens || u.input_tokens) {
            jobs.push(() => {
              const info = insertAssistant.run(
                sessionId, ts, a.text, a.toolNames.join(","), obj.uuid || null,
                model,
                Number(u.input_tokens || 0),
                Number(u.output_tokens || 0),
                Number(u.cache_creation_input_tokens || 0),
                Number(u.cache_read_input_tokens || 0),
                stop
              );
              if (info.changes > 0) stats.newAssistantTurns++;
            });
            for (const call of a.toolCalls) {
              const fp = extractFilePath(call.name, call.input);
              const cmd = extractCommand(call.name, call.input);
              const argsStr = call.input ? JSON.stringify(call.input).slice(0, 4000) : null;
              jobs.push(() => {
                insertToolCall.run(sessionId, pid, obj.uuid || null, ts, call.name, fp, cmd, argsStr);
              });
            }
          }
        }
      });

      jobs.push(() => {
        upsertSession.run(
          sessionId, pid,
          sessionMeta.started_at || null,
          sessionMeta.ended_at || null,
          sessionMeta.entrypoint || null,
          sessionMeta.version || null,
          sessionMeta.git_branch || null,
          sessionMeta.permission_mode || null,
          sessionMeta.slug || null,
        );
      });
      jobs.push(() => setFileState(fp, st.mtimeMs, st.size, newLastByte));

      tx(jobs);
      if (opts.verbose) console.log(`[idx] ${path.basename(f)}: +${stats.newPrompts} prompts so far`);
    }
  }

  indexPlans(stats);
  indexTodos();
  refreshProjectAggregates();
  refreshSessionTurnCounts();
  linkPlansToSessions();

  setMeta("last_index_at", String(Date.now()));
  stats.durationMs = Date.now() - start;
  return stats;
}

function indexPlans(stats: IndexStats) {
  const dir = paths.plans();
  const files = safeReadDir(dir).filter(f => f.endsWith(".md"));
  stats.plans = files.length;
  const D = db();
  const up = D.prepare(`
    INSERT INTO plans(slug,path,title,body,word_count,mtime,linked_session_id)
    VALUES(?,?,?,?,?,?,NULL)
    ON CONFLICT(slug) DO UPDATE SET path=excluded.path, title=excluded.title, body=excluded.body,
      word_count=excluded.word_count, mtime=excluded.mtime
  `);
  for (const f of files) {
    const full = path.join(dir, f);
    let st: fs.Stats;
    try { st = fs.statSync(full); } catch { continue; }
    const slug = f.replace(/\.md$/, "");
    const body = fs.readFileSync(full, "utf8");
    const title = (body.match(/^#\s+(.+)$/m)?.[1] ?? slug).trim();
    const wc = body.trim().length ? body.trim().split(/\s+/).length : 0;
    up.run(slug, full, title, body, wc, st.mtimeMs);
  }
}

function indexTodos() {
  const dir = paths.todos();
  const files = safeReadDir(dir).filter(f => f.endsWith(".json"));
  const D = db();
  const up = D.prepare(`
    INSERT INTO todos(session_id,json,mtime) VALUES(?,?,?)
    ON CONFLICT(session_id) DO UPDATE SET json=excluded.json, mtime=excluded.mtime
  `);
  for (const f of files) {
    const full = path.join(dir, f);
    let st: fs.Stats;
    try { st = fs.statSync(full); } catch { continue; }
    // filename has shape: <sessionId>-agent-<uuid>.json OR <sessionId>.json
    const base = f.replace(/\.json$/, "");
    const sessionId = base.split("-agent-")[0];
    try {
      const body = fs.readFileSync(full, "utf8");
      up.run(sessionId, body, st.mtimeMs);
    } catch {}
  }
}

function refreshProjectAggregates() {
  db().exec(`
    UPDATE projects SET
      session_count = (SELECT COUNT(*) FROM sessions WHERE sessions.project_id = projects.id),
      prompt_count  = (SELECT COUNT(*) FROM prompts  WHERE prompts.project_id  = projects.id),
      first_seen    = (SELECT MIN(ts) FROM prompts WHERE prompts.project_id = projects.id),
      last_seen     = (SELECT MAX(ts) FROM prompts WHERE prompts.project_id = projects.id)
  `);
}

function refreshSessionTurnCounts() {
  db().exec(`
    UPDATE sessions SET turn_count = (SELECT COUNT(*) FROM prompts WHERE prompts.session_id = sessions.id)
  `);
}

function linkPlansToSessions() {
  db().exec(`
    UPDATE plans SET linked_session_id = (
      SELECT s.id FROM sessions s WHERE s.slug = plans.slug ORDER BY s.started_at DESC LIMIT 1
    )
  `);
}
