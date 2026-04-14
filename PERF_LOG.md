# Perf loop log

| date | target | before (ms) | after (ms) | mechanism |
|---|---|---|---|---|

## Baseline sweep — 2026-04-14

Dev-mode (`npm run dev`, Next 15.5, local). Warm median (3 samples):

| route | warm (s) |
|---|---|
| /graph | 0.11 |
| /analytics | 0.13 |
| /tags | 0.13 |
| /slashes | 0.14 |
| /timeline | 0.18 |
| /prompts | 0.20 |
| /plans | 0.23 |
| /week | 0.23 |
| /anomalies | 0.24 |
| /today | 0.31 |
| /wordcloud | 0.31 |
| /agents | 0.28 |
| /tools | 0.31 |
| /tokens | 0.32 |
| /burndown | 0.34 |
| /calendar | 0.36 |
| /repeats | 0.37 |
| /rankings | 0.40 |
| /highlights | 0.41 |
| /skills | 0.27 |
| /commands | 0.64 |
| /files | 0.58 |
| / | 0.36 |

## Reverted investigations (no win earned)

### 2026-04-14 — `fileUsage` 60s TTL cache
Hypothesis: /files warm at 580ms, with `fileUsage` groupby at 472ms uncached, cache would drop page to <100ms.

Reality: on second measurement `fileUsage` was only 37ms (SQLite page cache had warmed up). Cache correct but saved ~35ms on a 580ms response. Under 20% threshold, reverted.

Lesson: re-measure query cost under actual steady-state, not once-per-session cold.

### 2026-04-14 — session_rollups materialized table
Hypothesis: `tokenSummary.byProject` (66ms cold / 31ms warm) and `.bySession` (69ms cold / 11ms warm) scan 44k `assistant_turns` on every /tokens hit. Pre-aggregating into 250-row rollup table should cut page latency meaningfully.

Reality: standalone query times dropped 50–100× (0.5ms / 0.6ms). Page-level latency essentially unchanged (0.28–0.34s warm median, baseline 0.27–0.32s). The page is render-bound in dev mode at ~250ms floor; 40ms DB savings disappeared into that.

Reverted per protocol. Noting for future: this change would likely show a real win in `next build && next start` production mode, and should be re-tried there.

Lesson: in Next.js dev mode, DB optimizations under ~100ms don't surface to user-visible latency because dev-mode compile/render overhead dominates. Real perf measurement for this app needs a production build.
