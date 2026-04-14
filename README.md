# CC Prompt Overseer

A local-only browser app to explore every Claude Code prompt and plan you've ever written. Reads `~/.claude/projects/*.jsonl` and `~/.claude/plans/*.md` directly off your disk, indexes them into a local SQLite database, and gives you a wide range of ways to view, search, rank, and annotate them.

**No network calls. No APIs. No telemetry.** Open the database file with any SQLite client if you want to verify.

## Quick start

```bash
npm install
npm run dev
```

Then open http://127.0.0.1:3737. (We bind to 127.0.0.1 on port 3737 to dodge a common port-3000 collision on Windows.)

The first page load triggers an automatic index of `~/.claude/`. With ~900 MB of session JSONL it takes ~5 seconds. Subsequent loads are incremental — only changed files are re-read.

## What you get

| Page | What it does |
|---|---|
| **Dashboard** (`/`) | Counters, day×hour heatmap, recent prompts, recent plans, top projects |
| **All Prompts** (`/prompts`) | Virtualized table of every prompt with filters: project, slash-only, starred, has-plan, min length, FTS5 search, sort by time/length/interest. Click a row → side panel with full text, star, 1–5 rating, free-form notes |
| **Plans** (`/plans`) | Card grid of every plan file. Click → full markdown render with link to the originating session |
| **Projects** (`/projects`) | Every working-directory CC has run in, with prompt/session/plan counts |
| **Sessions** (`/sessions/[id]`) | Full conversation replay — your prompts + Claude's turns + collapsible tool calls + the plan side-by-side if one was written |
| **Timeline** (`/timeline`) | Heatmap + weekly trend + clickable list of recent days |
| **Rankings** (`/rankings`) | Eight leaderboards: longest prompts, most-used slash commands, busiest sessions/days/hours, longest plans, your starred prompts, top projects |
| **Analytics** (`/analytics`) | Per-week prompt counts, avg prompt length over time, slash-command histogram, permission-mode mix, entrypoint mix |
| **Word Cloud** (`/wordcloud`) | Top tokens — click a word to filter the prompt table |
| **Search** (`/search`) | FTS5 full-text search with BM25 ranking, snippet highlighting |
| **Graph** (`/graph`) | Force-directed network of projects ↔ sessions ↔ plans |
| **Command palette** (⌘K / Ctrl+K) | Jump to any project, plan, or prompt |

## Ranking

Each prompt has an automatic interest score combining length, starred state, and whether a plan was produced. You can also star, rate 1–5, tag, and add personal notes — all stored locally in `overseer.db`.

## How it works

- `lib/indexer.ts` walks `~/.claude/projects/*/*.jsonl` line-by-line and inserts user prompts and assistant turns into SQLite. It tracks `(file, mtime, size, last_byte)` so repeat runs only process new content.
- `lib/queries.ts` is the read layer (SQL with FTS5 search).
- All routes are Next.js App Router server components reading SQLite synchronously via `better-sqlite3`. No client/server data fetching dance.
- The only writes are to `./overseer.db` (your stars/ratings/notes). Nothing under `~/.claude/` is ever modified.

## Refreshing the index

Click "Refresh index" in the sidebar after a new CC session, or `POST /api/refresh`, or `npm run index` from the CLI.

## Troubleshooting

- **`better-sqlite3` build fails** — needs Node 22 + Visual Studio Build Tools on Windows (or just use the prebuilt binary that npm installs by default; this works out of the box for me).
- **Different `~/.claude` path** — set `CLAUDE_HOME=C:/whatever/.claude` in your environment.
- **DB at a different path** — set `OVERSEER_DB=C:/whatever/db.sqlite`.
- **Slow first index** — expected; 900 MB of session logs takes a few seconds. Subsequent runs only re-read changed files.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v3 · better-sqlite3 (FTS5) · TanStack Virtual · Recharts · Cytoscape · cmdk · react-markdown · shiki.
