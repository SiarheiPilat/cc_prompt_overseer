import { db } from "./db";

type Row = { id: number; uuid: string | null; text: string; session_id: string; ts: number; cwd: string | null };
type Index = {
  rows: Map<number, Row>;
  uuidToId: Map<string, number>;
  idToTokens: Map<number, Map<string, number>>;   // tf per doc
  docLen: Map<number, number>;
  idf: Map<string, number>;
  postings: Map<string, number[]>;                 // inverted index: token -> prompt ids
  builtAt: number;
  version: string;
};

let cache: Index | null = null;

const STOP = new Set([
  "the","a","an","and","or","but","of","to","in","on","for","with","is","it","this","that","as","at","by","be","are","was","were","from","can","not","you","i","we","they","if","so","do","does","did","my","me","our","your","their","has","have","had","get","got","go","see","like","just","some","all","how","what","why","when","where","who","which","than","then","there","here","up","down","out","into","about","over","after","before","off","too","very","more","most","no","yes","use","using","used","one","two","three","any","way","make","sure","also","want","need","should","would","could","might","may","let","lets","think","know","new","old","run","ran","make","made","good","bad","also","tell","says","said","ok","okay","please","thanks","thank","try","trying","tried","going","gonna","wanna","kinda","actually","basically","really","pretty","quite","stuff","thing","things","something","anything","everything","nothing"
]);

function tokenize(text: string): string[] {
  if (!text) return [];
  const low = text.toLowerCase().replace(/```[\s\S]*?```/g, " ").replace(/[^a-z0-9_\-\/\.\s]/g, " ");
  return low.split(/\s+/).filter(t => t.length >= 3 && t.length <= 24 && !STOP.has(t));
}

function buildIndex(): Index {
  const rows = db().prepare(`
    SELECT p.id, p.uuid, p.text, p.session_id, p.ts, pr.cwd
    FROM prompts p LEFT JOIN projects pr ON pr.id = p.project_id
    WHERE p.char_count >= 20
  `).all() as Row[];
  const rowsMap = new Map<number, Row>();
  const uuidToId = new Map<string, number>();
  const idToTokens = new Map<number, Map<string, number>>();
  const docLen = new Map<number, number>();
  const df = new Map<string, number>();
  const postings = new Map<string, number[]>();

  for (const r of rows) {
    rowsMap.set(r.id, r);
    if (r.uuid) uuidToId.set(r.uuid, r.id);
    const tokens = tokenize(r.text);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    idToTokens.set(r.id, tf);
    docLen.set(r.id, tokens.length);
    for (const t of tf.keys()) {
      df.set(t, (df.get(t) || 0) + 1);
      const arr = postings.get(t);
      if (arr) arr.push(r.id); else postings.set(t, [r.id]);
    }
  }
  const N = rows.length || 1;
  const idf = new Map<string, number>();
  for (const [t, n] of df.entries()) {
    // Drop extremely common tokens (appear in >40% of docs) — they're noise
    if (n / N > 0.4) continue;
    idf.set(t, Math.log(1 + N / n));
  }
  return { rows: rowsMap, uuidToId, idToTokens, docLen, idf, postings, builtAt: Date.now(), version: "1" };
}

function getIndex(): Index {
  if (!cache) cache = buildIndex();
  return cache;
}

export function invalidateSimilarity() { cache = null; repeatsCache = null; }

let repeatsCache: { key: string; at: number; data: any[] } | null = null;
const REPEATS_TTL_MS = 60_000;

export function findRepeats(opts: { minScore?: number; minLen?: number; sampleSize?: number; limit?: number } = {}) {
  const minScore = opts.minScore ?? 0.4;
  const minLen = opts.minLen ?? 60;
  const sampleSize = opts.sampleSize ?? 800;
  const limit = opts.limit ?? 40;
  const key = `${minScore}|${minLen}|${sampleSize}|${limit}`;
  if (repeatsCache && repeatsCache.key === key && Date.now() - repeatsCache.at < REPEATS_TTL_MS) {
    return repeatsCache.data;
  }
  const idx = getIndex();

  // Take the longest prompts as seeds
  const seeds: number[] = [];
  const all = Array.from(idx.rows.values()).filter(r => r.text.length >= minLen);
  all.sort((a, b) => b.text.length - a.text.length);
  for (const r of all.slice(0, sampleSize)) seeds.push(r.id);

  const seenPair = new Set<string>();
  const seenSession = new Set<string>(); // dedupe per (sessionA<->sessionB)
  const out: Array<{ a: any; b: any; score: number }> = [];

  for (const seedId of seeds) {
    const src = idx.rows.get(seedId);
    if (!src || !src.uuid) continue;
    const matches = similarTo(src.uuid, 8);
    for (const m of matches) {
      if (m.session_id === src.session_id) continue;
      if (m.score < minScore) continue;
      const pairKey = seedId < m.id ? `${seedId}-${m.id}` : `${m.id}-${seedId}`;
      if (seenPair.has(pairKey)) continue;
      seenPair.add(pairKey);
      const sessionPair = src.session_id < m.session_id ? `${src.session_id}|${m.session_id}` : `${m.session_id}|${src.session_id}`;
      if (seenSession.has(sessionPair)) continue;
      seenSession.add(sessionPair);
      out.push({
        a: { id: src.id, text: src.text.slice(0, 400), session_id: src.session_id, ts: src.ts, cwd: src.cwd },
        b: { id: m.id, text: m.text, session_id: m.session_id, ts: m.ts, cwd: m.cwd },
        score: m.score,
      });
      if (out.length >= limit * 3) break;
    }
    if (out.length >= limit * 3) break;
  }
  out.sort((a, b) => b.score - a.score);
  const result = out.slice(0, limit);
  repeatsCache = { key, at: Date.now(), data: result };
  return result;
}

export function similarTo(uuid: string, limit = 5): Array<{
  id: number; uuid: string | null; session_id: string; ts: number; score: number; text: string; cwd: string | null;
}> {
  const idx = getIndex();
  const id = idx.uuidToId.get(uuid);
  if (!id) return [];
  const srcTf = idx.idToTokens.get(id);
  if (!srcTf) return [];
  const srcVec = new Map<string, number>();
  let srcNorm = 0;
  for (const [t, f] of srcTf.entries()) {
    const w = idx.idf.get(t);
    if (!w) continue;
    const v = f * w;
    srcVec.set(t, v);
    srcNorm += v * v;
  }
  srcNorm = Math.sqrt(srcNorm) || 1;

  // Candidates: docs sharing at least 1 meaningful token; weight by idf threshold
  const candidateScore = new Map<number, number>();
  for (const [t, v] of srcVec.entries()) {
    const posts = idx.postings.get(t);
    if (!posts) continue;
    if (posts.length > 300) continue; // skip very common tokens
    for (const pid of posts) {
      if (pid === id) continue;
      const other = idx.idToTokens.get(pid);
      if (!other) continue;
      const f = other.get(t) || 0;
      if (!f) continue;
      const w = idx.idf.get(t)!;
      candidateScore.set(pid, (candidateScore.get(pid) || 0) + v * f * w);
    }
  }
  if (candidateScore.size === 0) return [];

  // Normalize — compute each candidate's vector norm lazily, cached per call
  const cnorm = new Map<number, number>();
  function norm(pid: number): number {
    const cached = cnorm.get(pid);
    if (cached != null) return cached;
    const tf = idx.idToTokens.get(pid)!;
    let n = 0;
    for (const [t, f] of tf.entries()) {
      const w = idx.idf.get(t);
      if (!w) continue;
      n += (f * w) ** 2;
    }
    const v = Math.sqrt(n) || 1;
    cnorm.set(pid, v);
    return v;
  }

  const scored: Array<[number, number]> = [];
  for (const [pid, dot] of candidateScore.entries()) {
    scored.push([pid, dot / (srcNorm * norm(pid))]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  const out: any[] = [];
  for (const [pid, score] of scored.slice(0, limit * 2)) {
    const r = idx.rows.get(pid);
    if (!r) continue;
    if (score < 0.12) continue; // de-noise threshold
    out.push({ id: r.id, uuid: r.uuid, session_id: r.session_id, ts: r.ts, score, text: r.text.slice(0, 400), cwd: r.cwd });
    if (out.length >= limit) break;
  }
  return out;
}
