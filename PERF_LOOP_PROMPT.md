# CC Prompt Overseer — performance self-improvement loop

Run this with the `/loop` skill. Two modes:

```
/loop 25m  <paste the CONTENTS of this file>    # fixed cadence, good while AFK
/loop      <paste the CONTENTS of this file>    # self-paced, model decides when to wake
```

---

## ROLE

You are the perf maintainer of the local Next.js app at `C:\GitHub\QOL_projects\cc_prompt_overseer`. Everything runs on localhost, reads `~/.claude/` from disk, and writes only to `./overseer.db` (better-sqlite3 with FTS5). Dev server lives at `http://127.0.0.1:3737`. Your only goal each iteration: **make a user-perceived latency win, with numbers to prove it.**

## NON-NEGOTIABLES — read these every iteration

1. **Measure before touching code.** No exceptions. Pick a target (route, query, script) and record its current timing BEFORE making changes. If you can't measure it, you can't improve it.
2. **One change per iteration.** Ship one targeted optimization, re-measure, commit the win with before/after numbers. Don't stack "while I'm here" tweaks — they hide regressions in the signal.
3. **Target real user latency, not micro-benchmarks.** p50 curl `time_total` from a cold + warm browser hit matters. A 10 µs gain inside a hot-path loop that the user never notices does not.
4. **Correctness first.** Every optimization must keep output identical. A faster-but-wrong answer is a bug, not a win. After each change, spot-check a few queries' outputs vs. pre-change.
5. **No new dependencies.** Stick to what's installed. If you're tempted by Redis / LRU-cache / msgpack, ask yourself what you'd do without them first. Usually the answer is better SQL or a module-scope Map.
6. **Local-only.** No network calls, no LLM calls, no telemetry, no external cache. Everything must work with just `npm run dev`.
7. **Stop when the iteration is done.** Shipping one well-measured improvement per loop compounds; chaining features does not.

## THE MEASUREMENT PROTOCOL — use this every time

Before changing anything, record baseline:

```bash
# 1. Cold start (kill dev, restart, time first hit)
# 2. Warm hit (already compiled, cache populated)
# 3. Repeat 3x, take median

for i in 1 2 3; do
  curl -sS -o /dev/null -w "%{time_total}s\n" http://127.0.0.1:3737/<route>
done
```

For DB-bound routes, also check:

```bash
# How much time is SQL vs framework?
node -e "
  const D = require('better-sqlite3')('overseer.db');
  const t = Date.now();
  const rows = D.prepare(\`YOUR QUERY HERE\`).all();
  console.log('ms:', Date.now() - t, 'rows:', rows.length);
"
```

Explain plan for slow queries:

```bash
node -e "
  const D = require('better-sqlite3')('overseer.db');
  console.table(D.prepare('EXPLAIN QUERY PLAN YOUR_QUERY').all());
"
```

Record results in a scratch table for the iteration; include them in the commit message.

## WHAT TO MEASURE FIRST EACH ITERATION

Run this baseline sweep on every fresh wake — takes ~10s:

```bash
for route in / /today /prompts /tokens /sessions/<pick-a-big-one> \
             /files /commands /agents /burndown /repeats /anomalies \
             /compare?a=X&b=Y; do
  printf "%-45s " "$route"
  curl -sS -o /dev/null -w "%{time_total}s\n" "http://127.0.0.1:3737$route"
done
```

Anything over **500 ms cold / 200 ms warm** on a page with <2000 rows is worth a look. Under that, find a different target.

Also check DB size and cache state:

```bash
node -e "
  const D = require('better-sqlite3')('overseer.db');
  const counts = ['prompts','assistant_turns','tool_calls','plans','sessions','projects']
    .map(t => [t, D.prepare('SELECT COUNT(*) n FROM ' + t).get().n]);
  console.table(counts);
  console.log('db size:', require('fs').statSync('overseer.db').size / 1e6 + ' MB');
"
```

## PERF BACKLOG (pick ONE; measure first; record delta)

### Query-level — usually the biggest wins

- [ ] **EXPLAIN QUERY PLAN** every slow query. Missing composite indexes on `(project_id, ts)`, `(session_id, ts)`, `(category, ts)` are common. Add only indexes that show up as SCAN → SEARCH improvements.
- [ ] **Pre-aggregated tables.** `daily_counts(project_id, d, prompts, tokens_in, tokens_out, cache_read, cache_write)` refreshed at end of every index run. `/calendar`, `/timeline`, `/week`, `/today` all read from this instead of grouping raw rows. Invalidate on reindex. Huge win if the user gets to 10+ years of data.
- [ ] **Session-level rollups.** `session_rollups(session_id, turn_count, total_output, total_input, cache_creation, cache_read, last_ts, first_ts)` updated incrementally during index. `/compare`, `/projects/[id]/report`, `/projects/[id]`, `/burndown`, `/highlights` all do the same SUM joins — precompute once.
- [ ] **Materialized heatmap.** `heatmap_cells(dow, hour, n, top3_json)` recomputed on index. The window-function query in `heatmapTopSessions()` is O(all prompts) and runs twice per dashboard load.
- [ ] **Similarity cache warm-up.** The first `/api/similar` or `/repeats` visit builds the TF-IDF index (~900 ms). Trigger `getIndex()` on dev boot or lazily in a setImmediate after server ready, so user-visible first hit is warm.
- [ ] **FTS5 optimize.** Run `INSERT INTO prompts_fts(prompts_fts) VALUES('optimize');` after bulk inserts in the indexer. Shrinks FTS size and speeds BM25.
- [ ] **BM25 tuning.** `prompts_fts MATCH ? ORDER BY bm25(prompts_fts, 1.0, 0.5)` — play with column weights, favor recency via a boost column.
- [ ] **Swap LIKE for FTS** on plans search (only 46 rows today, but cheap fix).
- [ ] **Prepared statement reuse.** Several query functions re-prepare on each call. Pull statements into module scope so better-sqlite3 caches the compiled SQL.

### Route-level

- [ ] **Parallel data fetches.** Next.js server components await each query sequentially. For pages with N independent queries (dashboard, tokens, today, week), gather into `Promise.all([...])`. Even though better-sqlite3 is sync, reading raw rows is ~free; bigger win is moving CPU work off the render path.
- [ ] **Virtualize lists** on `/files`, `/commands`, `/agents`, `/skills`, `/repeats`. Currently these render full tables. Under 200 rows is fine; above that, switch to the same `useVirtualizer` pattern as `/prompts`.
- [ ] **Lazy-load assistant turn bodies.** `/sessions/[id]` pulls every turn's full text up front. Paginate: load first 100, "load more" button or IntersectionObserver for the rest. Also store turn `text` as NULL for empty/tool-only turns to save JSON payload.
- [ ] **Shrink per-row payloads** on `/prompts` — stop selecting `p.text` in the initial query, fetch it on-demand when a row is selected. At 2000 rows with 2KB avg = 4 MB wire payload per load.
- [ ] **Reuse search index across requests.** The similarity module is already singleton; verify it survives HMR reloads correctly on every code change (check `globalThis.__overseer_similarity`).

### Indexer

- [ ] **Streaming parser profile.** Time `streamLines()` alone on the biggest JSONL (`~/.claude/projects/...defactory-OTA - Copy (2)/...`). If > 50% of index time, consider batching inserts into larger transactions (current: one tx per file, good; prepared statements bound in tx, good; check if `autocommit` mode costs us).
- [ ] **Skip unchanged files earlier.** Current `file_state` check runs after a stat. Cheap but could be colder. Measure real skip rate per reindex.
- [ ] **Debounce tuning.** Chokidar watcher debounce is 1.5s — might be too aggressive while a CC session is actively appending. Try 3–5s, measure index calls per minute during a live session.
- [ ] **Vacuum + analyze.** `VACUUM; ANALYZE;` once after the first full index (behind a `?full=1` flag on `/api/refresh`). Stats help the planner.
- [ ] **WAL checkpoint** after big writes: `PRAGMA wal_checkpoint(TRUNCATE);`. Prevents WAL file bloat.

### Frontend

- [ ] **Shiki lazy load.** If any plan markdown renders with code fences, shiki imports its theme/language bundle eagerly. Move to dynamic import or swap for prism-lite if shiki isn't loading fast.
- [ ] **Recharts weight.** ~200 KB gzipped. If Analytics / Tokens pages aren't used often, dynamic-import the chart components so they don't block first paint of the nav.
- [ ] **Cytoscape.** Only loaded on `/graph`, good. Verify it isn't pre-bundled into other routes.
- [ ] **Client-component reduction.** Anything that doesn't need interactivity should be a server component. Check imports of `"use client"` — is every directive necessary?
- [ ] **next/font.** No custom font today, uses system. Fine. If one gets added, use `next/font/local` to avoid FOUT/CLS.

### Caching

- [ ] **TTL cache for `/repeats`** — already done (60s). Extend the pattern to `/rankings`, `/highlights`, `/anomalies` — all are expensive and idempotent under unchanged data.
- [ ] **Cache invalidation on watcher event.** Any module-scope cache must clear when the SSE `indexed` event fires, not just on manual refresh.

## THE ITERATION RITUAL

```
1. curl baseline sweep. Write numbers into a scratch block.
2. Pick ONE target whose number is worst AND whose fix is bounded.
3. EXPLAIN QUERY PLAN (if DB) or profile (if CPU).
4. Form a hypothesis. Write it down as a one-liner.
5. Implement the smallest change that tests the hypothesis.
6. Re-measure. 3x warm hits; take median.
7. Correctness spot-check: diff output against pre-change (a dump to /tmp works).
8. If median latency drop < 20%, revert. You're chasing noise.
9. TaskUpdate; STOP. The loop will fire you again.
```

## ANTI-PATTERNS — exit immediately if you catch yourself

- Adding a cache whose invalidation strategy is "trust me"
- Using `Promise.all` for better-sqlite3 calls (it's sync — no benefit, just confusion)
- Micro-optimizing a render path without a Lighthouse/devtools profile showing it's hot
- Replacing correct SQL with "clever" JS because JS "feels faster"
- Upgrading a dependency to get a perf claim without verifying on this dataset
- Adding a `DROP INDEX`/`CREATE INDEX` cycle without first checking the planner actually uses the new index
- Widening a schema change into a "let me also refactor" session
- Chasing an optimization on a route the user never visits

## HARD-STOP CONDITIONS

- If the baseline sweep shows every route warm under 200 ms, there's nothing user-visible to fix. **Stop the loop.** Tell the user everything is fast enough and list the current numbers.
- If an optimization regresses another route (always re-sweep the full baseline after a change), revert and commit a debrief in `PERF_LOG.md` explaining the interaction.
- If the indexer gets slower than baseline by > 10% for any change, revert. Full reindex cost hurts more than page speed.

## WHAT SUCCESS LOOKS LIKE

At the end of N iterations, `PERF_LOG.md` (you create and maintain it) should be a dated table of:

| date | target | before (ms) | after (ms) | mechanism |

Each row a win, evidenced. No essays, no excuses. If you can't add a row, you didn't earn an iteration.

End of loop prompt.
