# CC Prompt Overseer — self-improvement loop prompt

---

## ROLE

You are the maintainer of a local Next.js app at `C:\GitHub\QOL_projects\cc_prompt_overseer` that lets the user explore their own Claude Code history (every prompt, plan, session, project — indexed from `~/.claude/` into a local SQLite DB). Tech: Next.js 15 App Router, React 19, TS, Tailwind v3, better-sqlite3 (FTS5), TanStack Virtual, Recharts, Cytoscape, cmdk. Dev server runs at `http://127.0.0.1:3737`.

## OBJECTIVE EACH ITERATION

Pick **exactly ONE** improvement from the backlog (or invent a better one), implement it end-to-end, smoke-test it, and stop. Quality > volume. One small, polished, working feature beats five half-broken ones.

## DISCIPLINE — non-negotiable

1. **Read the current state first.** `npm run typecheck` (it's lenient — focus on actual errors, not strict-mode noise). If the app is already running, hit a few routes with curl to confirm baseline. Don't assume — verify.
2. **Pick ONE thing.** Update TaskCreate with what you're doing. If the change touches the indexer schema, bump `SCHEMA_VERSION` in `lib/indexer.ts` (forces reindex on next run).
3. **No new dependencies** unless the gain is enormous. Prefer building with what's installed (recharts, cytoscape, cmdk, react-markdown, shiki, better-sqlite3, tanstack/\* — there's a lot).
4. **Read-only against** **`~/.claude/`.** The only writes anywhere are to `./overseer.db`. If you find yourself reaching for `fs.writeFile` on a Claude path, stop.
5. **Local-only.** No network, no LLM calls, no telemetry, no external services. If you need NLP-ish features (clustering, similarity), do them with deterministic heuristics or simple math (TF-IDF, Jaccard, cosine on bag-of-words). Stopword list is in `lib/categorize.ts` style — extend, don't fetch.
6. **Smoke test before claiming done.** Hit your new route with curl AND open it in the user's browser tab if a critical UI piece changed (use `mcp__claude-in-chrome__navigate` against `http://127.0.0.1:3737/<your-page>`). Verify real data renders, not skeletons. If a chart looks empty, debug the SQL — don't ship it broken.
7. **Stop when done.** Do not chain "while I'm here, let me also…". The next loop iteration will pick up the next thing. Iteration discipline is what makes this loop compound instead of sprawl.
8. **No emojis.** No marketing copy. No README rewrites unless the README is actually wrong. No "polish" passes that just shuffle whitespace.

## WHERE TO LOOK FIRST EACH ITERATION

- Run `git status` and `git diff --stat` (if it's a git repo) to see what's changed since last loop. Avoid stepping on in-progress work.
- `node -e "const D=require('better-sqlite3')('overseer.db'); console.log(D.prepare('SELECT key,value FROM meta').all());"` — see when the DB was last indexed, schema version.
- Sample 5 random sessions and skim their JSONLs to find data we're not yet indexing (e.g. tool arguments, file paths touched, error messages, hook events, sidechain agents). The JSONL files at `C:\Users\User\.claude\projects\` are the source of truth — there's gold there we haven't mined.
- Run the dev server, click around `/`, `/prompts`, `/tokens`, `/sessions/<id>` — find anything that's slow, ugly, or empty. Fix the worst-feeling thing.

## BACKLOG (pick one; reorder freely as priorities shift)

### Data depth

- [ ] Index tool arguments (e.g. for `Edit`, capture `file_path`; for `Bash`, capture the command). Add a `tool_calls` table joined to `assistant_turns`.
- [ ] Detect and store **file paths** mentioned/edited per session → page `/files` showing top-edited files across all projects.
- [ ] Index `Bash` commands actually run; show a `/commands` page with frequency, recency, and a "copy" button. Filter out destructive ones.
- [ ] Capture `stop_reason` distribution per session → flag sessions with `tool_use_max_iterations` or unusual stops.
- [ ] Parse system reminder hooks fired (count per session, type breakdown).
- [ ] Index sidechain agent invocations (subagent_type, prompt) → `/agents` page showing how often you delegate and to whom.
- [ ] Detect prompt-to-output ratio (output tokens per prompt char) — surface as "verbosity score" per session.

### Better viewing

- [ ] **Compare sessions side-by-side**: pick two session IDs, render prompts & turns in two columns with diff highlighting on shared tool names.
- [ ] **Saved searches / smart playlists**: store named filter sets in a new `playlists` table; sidebar shortcut.
- [ ] **Prompt similarity**: TF-IDF + cosine over the prompts table, batched offline; show "5 most similar prompts" in the prompt detail panel.
- [ ] **Session map**: timeline strip for one session showing prompt density × token cost per minute.
- [ ] **Diff plan vs. session**: side-by-side of the plan markdown next to the prompts that came after it.
- [ ] **Threaded view**: walk `parent_uuid` chains; render conversation as a tree so branched corrections are obvious.
- [ ] **Markdown export**: select prompts from the table, export to a markdown file (POST `/api/export` returns a download).

### Reporting

- [ ] **Weekly digest** (`/digest`): one screen per ISO week — top topics, longest sessions, cost, plans written, % time on each project.
- [ ] **Project report card** (`/projects/[id]/report`): completion summary, time spent, total cost, % of prompts that were debug vs. build, plans written, biggest sessions.
- [ ] **Burndown view**: prompts per project over time — when did you start, when did activity taper, are you still working on it.
- [ ] **Anomaly detector**: flag days with > 2σ activity vs. user's rolling avg; flag sessions > 90th percentile cost.
- [ ] **Personal "best of"** (`/highlights`): mix of starred prompts, highest-interest auto-scored prompts, and longest-running sessions.
- [ ] **CSV / JSON export** of any table (POST `/api/export?table=prompts&format=csv`).

### Quality of life

- [ ] **Tag UI**: free-form tag input on prompt detail; tag cloud at `/tags`; filter prompts by tag.
- [ ] **Bulk star / bulk tag** from the prompts table (multi-select rows + action bar).
- [ ] **Keyboard nav** in the prompt detail panel: `j`/`k` to step through current filter result set without closing the panel.
- [ ] **Sticky filters**: persist last-used `/prompts` filters in localStorage, restore on revisit.
- [ ] **Dark/light toggle** (currently dark-only). Use a CSS-var swap.
- [ ] **Tooltips on heatmap cells** showing top 3 sessions for that hour.
- [ ] **In-table inline expansion**: click a row to expand a 6-line preview without opening the detail panel.

### Performance

- [ ] **Watch mode**: chokidar watcher on `~/.claude/projects/` that incrementally upserts new lines and pushes via SSE → UI updates without a manual refresh.
- [ ] **Pre-aggregated daily counters** table refreshed on index → make `/calendar` and `/timeline` instant for 10+ years of data.
- [ ] **FTS BM25 weighting**: tune weights so longer recent prompts rank higher than ancient repetitions.
- [ ] **Lazy load** the assistant turn body in session replay (currently eagerly loads every turn).

### Things the user hasn't asked for but probably wants

- [ ] **"What did I work on today?"** — single-route summary at `/today` with active sessions, prompts written, files touched, plans started.
- [ ] **Idle-time detection**: gaps > 15 min between prompts → segment a session into "bursts"; show burst count + avg burst length.
- [ ] **Slash-command success metric**: for slash prompts, measure how many follow-up prompts the user wrote in the same minute (heuristic for "did the slash do the job").
- [ ] **Plan completion estimator**: count how many bullet items in a plan have been "done" based on assistant turns referencing the plan slug.
- [ ] **"Repeat questions" detector**: prompts you've asked across multiple projects (similarity > 0.8) — surface as "you keep asking this; consider a CLAUDE.md".
- [ ] **CLAUDE.md / settings.json reader**: surface per-project Claude config files and link them to that project's page.
- [ ] **Cost-per-week budget alert**: a UI banner if last week's est. cost is > N (configurable in a tiny `/settings` page that writes to the `meta` table).

## PROCESS

```
1. Read this prompt + git status + last meta entry from overseer.db.
2. Pick ONE backlog item (or a better idea inspired by what you see).
3. TaskCreate to log it.
4. Implement (small surface area, real impl, no stubs).
5. If schema changed: bump SCHEMA_VERSION, run `npm run index`, verify counts.
6. Smoke test: curl new route(s); browser-check critical UI.
7. TaskUpdate to completed.
8. STOP. End your turn. The loop will fire you again.
```

## ANTI-PATTERNS — exit immediately if you catch yourself

- Adding a feature flag, env var, or "config option" instead of just picking the right default.
- Renaming files/components without a functional reason.
- Writing tests for code that's already manually verified working (this is a personal-use tool; tests are not the priority).
- Scope-creep into "while I'm here, also refactor X".
- Inventing new tables when an existing one with one more column would do.
- Adding a dependency.

## WHEN STUCK

- If two iterations in a row failed the smoke test, the third should be a `revert + diagnose` iteration: roll back to last green state, write a one-paragraph debrief in `LOOP_LOG.md`, then stop.
- If you can't think of what to build, look at the data: pick the table with the least UI exposure (e.g. `assistant_turns.stop_reason` is captured but not surfaced anywhere) and build something around it.

End of loop prompt.
