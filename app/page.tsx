import Link from "next/link";
import { getDashboardSummary, heatmapData, heatmapTopSessions, tokenSummary, streakInfo, activeSessions, recentEdits, starredSessions } from "@/lib/queries";
import { fmtRelative, truncate, basename } from "@/lib/utils";
import { fmtTokens, fmtCost, costUSD } from "@/lib/pricing";
import { Heatmap } from "@/components/Heatmap";
import { budgetState } from "@/lib/budget";

export default function DashboardPage() {
  const { s, recent, recentPlans, topProjects } = getDashboardSummary();
  const heat = heatmapData();
  const heatTop = heatmapTopSessions();
  const tok = tokenSummary();
  const totalTokens = (tok.totals.input || 0) + (tok.totals.output || 0) + (tok.totals.cache_creation || 0) + (tok.totals.cache_read || 0);
  const totalCost = tok.byModel.reduce((sum, m) => sum + costUSD(m.model, m.input, m.output, m.cache_creation, m.cache_read), 0);
  const streak = streakInfo();
  const bs = budgetState();
  const active = activeSessions(60 * 60 * 1000) as any[];
  const edits = recentEdits(7 * 86400000, 12);
  const stars = starredSessions(6) as any[];
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-mutedfg">Everything your Claude Code sessions ever wrote, indexed locally.</p>
        </div>
        <Link href="/search" className="text-sm text-accent hover:underline">⌘K to search →</Link>
      </header>

      {(bs.budget.weekly > 0 && bs.weekPct >= 0.8) || (bs.budget.monthly > 0 && bs.monthPct >= 0.8) ? (
        <div className={`rounded-lg border p-3 text-sm ${
          (bs.weekPct >= 1 || bs.monthPct >= 1)
            ? "border-red-500/60 bg-red-500/15 text-red-200"
            : "border-amber-500/60 bg-amber-500/15 text-amber-200"
        }`}>
          <div className="flex flex-wrap gap-x-6 gap-y-1 items-center">
            <span className="font-medium">Budget alert:</span>
            {bs.budget.weekly > 0 && bs.weekPct >= 0.8 && (
              <span>This week {fmtCost(bs.weekSpend)} / {fmtCost(bs.budget.weekly)} ({(bs.weekPct * 100).toFixed(0)}%)</span>
            )}
            {bs.budget.monthly > 0 && bs.monthPct >= 0.8 && (
              <span>This month {fmtCost(bs.monthSpend)} / {fmtCost(bs.budget.monthly)} ({(bs.monthPct * 100).toFixed(0)}%)</span>
            )}
            <Link href="/settings" className="ml-auto text-xs underline opacity-80 hover:opacity-100">adjust →</Link>
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          ["Prompts", s.prompts.toLocaleString()],
          ["Sessions", s.sessions.toLocaleString()],
          ["Projects", s.projects.toLocaleString()],
          ["Plans", s.plans.toLocaleString()],
          ["Tokens", fmtTokens(totalTokens)],
          ["Est. cost", fmtCost(totalCost)],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-lg border border-border bg-card/60 p-4">
            <div className="text-xs text-mutedfg">{k}</div>
            <div className="text-2xl font-semibold tabular-nums">{v as string}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Mini label="Assistant turns" value={s.turns.toLocaleString()} />
        <Mini label="Starred prompts" value={s.starred.toLocaleString()} />
        <Mini label="Current streak" value={`${streak.current} days`} />
        <Mini label="Longest streak" value={`${streak.longest} days · ${streak.totalDays} total`} />
      </div>

      {active.length > 0 && (
        <section className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              Active in the last hour
            </h2>
            <span className="text-[11px] text-mutedfg">{active.length} {active.length === 1 ? "session" : "sessions"}</span>
          </div>
          <ul className="space-y-1">
            {active.map((s: any) => (
              <li key={s.id}>
                <Link className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-emerald-500/10 text-sm" href={`/sessions/${s.id}`}>
                  <span className="text-xs text-mutedfg w-20 tabular-nums">{fmtRelative(s.last_ts)}</span>
                  <span className="text-emerald-300 truncate flex-1 min-w-0">{s.slug || s.id.slice(0, 8)}</span>
                  <span className="text-xs text-mutedfg truncate max-w-[260px]">{basename(s.cwd || "")}</span>
                  <span className="text-xs text-emerald-300 tabular-nums w-12 text-right">+{s.recent_prompts}p</span>
                  <span className="text-xs text-mutedfg tabular-nums w-12 text-right">/{s.total_prompts}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Activity heatmap (day × hour, UTC) <span className="text-[10px] text-mutedfg font-normal">— hover for top sessions</span></h2>
          <Heatmap data={heat} topSessions={heatTop} />
        </div>
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Top projects</h2>
          <ul className="space-y-1">
            {(topProjects as any[]).map(p => (
              <li key={p.id}>
                <Link className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-muted/40 text-sm"
                      href={`/projects/${encodeURIComponent(p.id)}`}>
                  <span className="truncate">{p.cwd || p.id}</span>
                  <span className="text-xs text-mutedfg tabular-nums">{p.prompt_count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {stars.length > 0 && (
        <section className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3 flex items-center justify-between">
            <span>Starred sessions</span>
            <Link href="/sessions?starred=1" className="text-[11px] text-accent hover:underline font-normal">view all →</Link>
          </h2>
          <ul className="space-y-1">
            {stars.map((s: any) => (
              <li key={s.id}>
                <Link className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/40 text-sm" href={`/sessions/${s.id}`}>
                  <span className="text-yellow-300 shrink-0">★</span>
                  <span className="text-xs text-mutedfg w-20 tabular-nums">{fmtRelative(s.started_at)}</span>
                  <span className="text-accent truncate flex-1 min-w-0">{s.slug || s.id.slice(0, 8)}</span>
                  <span className="text-xs text-mutedfg truncate max-w-[200px]">{basename(s.cwd || "")}</span>
                  <span className="text-xs text-mutedfg tabular-nums">{s.prompt_count}p · {s.turn_count}t</span>
                </Link>
                {s.note && <div className="text-[11px] text-mutedfg italic ml-9 line-clamp-1">{s.note}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {edits.length > 0 && (
        <section className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Files edited in the last 7 days</h2>
          <ul className="space-y-1">
            {edits.map(e => (
              <li key={e.file_path}>
                <Link href={`/file?p=${encodeURIComponent(e.file_path)}`}
                  className="grid grid-cols-[1fr_60px_60px_80px] items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/40 text-sm">
                  <div className="min-w-0">
                    <div className="font-mono text-[12px] truncate" title={e.file_path}>{e.file_path}</div>
                  </div>
                  <span className="text-xs text-mutedfg tabular-nums text-right">{e.edits} edits</span>
                  <span className="text-xs text-mutedfg tabular-nums text-right">{e.sessions} sess</span>
                  <span className="text-xs text-mutedfg text-right">{fmtRelative(e.last_ts)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Recent prompts</h2>
          <ul className="space-y-1.5">
            {(recent as any[]).map(r => (
              <li key={r.id}>
                <Link href={`/sessions/${r.session_id}#p${r.id}`}
                  className="block rounded px-2 py-1.5 hover:bg-muted/40">
                  <div className="text-xs text-mutedfg flex gap-2">
                    <span>{fmtRelative(r.ts)}</span>
                    <span className="truncate">· {basename(r.cwd || "")}</span>
                  </div>
                  <div className="text-sm truncate">{truncate((r.snippet || "").replace(/\s+/g," "), 140)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Recent plans</h2>
          <ul className="space-y-1.5">
            {(recentPlans as any[]).map(p => (
              <li key={p.slug}>
                <Link href={`/plans/${encodeURIComponent(p.slug)}`}
                  className="block rounded px-2 py-1.5 hover:bg-muted/40">
                  <div className="text-xs text-mutedfg">{fmtRelative(p.mtime)}</div>
                  <div className="text-sm truncate">{p.title || p.slug}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="text-[10px] uppercase tracking-wide text-mutedfg">{label}</div>
      <div className="text-base font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
