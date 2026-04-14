import Link from "next/link";
import { notFound } from "next/navigation";
import { projectReport } from "@/lib/queries";
import { fmtDate, fmtRelative, truncate, basename } from "@/lib/utils";
import { fmtTokens, fmtCost, costUSD } from "@/lib/pricing";
import { Heatmap } from "@/components/Heatmap";

export const dynamic = "force-dynamic";

export default async function ProjectReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = projectReport(decodeURIComponent(id));
  if (!r) return notFound();

  const spanDays = r.totals.first_ts && r.totals.last_ts ? Math.max(1, Math.round((r.totals.last_ts - r.totals.first_ts) / 86400000)) : 0;
  const activeDays = r.days.length;
  const cost = costUSD(r.tokens.model, r.tokens.input || 0, r.tokens.output || 0, r.tokens.cache_creation || 0, r.tokens.cache_read || 0);
  const totalTokens = (r.tokens.input || 0) + (r.tokens.output || 0) + (r.tokens.cache_creation || 0) + (r.tokens.cache_read || 0);
  const totalCats = r.cats.reduce((s: number, c: any) => s + c.n, 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <div className="text-xs text-mutedfg">project report</div>
          <h1 className="text-2xl font-semibold break-words">{r.project.cwd || r.project.id}</h1>
          <div className="text-xs text-mutedfg mt-1">
            first seen {fmtRelative(r.totals.first_ts)} · last activity {fmtRelative(r.totals.last_ts)}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/projects/${encodeURIComponent(r.project.id)}`} className="text-sm px-3 py-1.5 rounded border border-border hover:bg-muted/60">sessions →</Link>
          <Link href={`/prompts?project=${encodeURIComponent(r.project.id)}`} className="text-sm bg-accent/20 text-accent px-3 py-1.5 rounded hover:bg-accent/30">prompts →</Link>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Stat label="Prompts" value={(r.totals.prompts || 0).toLocaleString()} />
        <Stat label="Sessions" value={(r.totals.sessions || 0).toLocaleString()} />
        <Stat label="Span" value={`${spanDays}d`} sub={`${activeDays} active`} />
        <Stat label="Tokens" value={fmtTokens(totalTokens)} />
        <Stat label="Cost" value={fmtCost(cost)} />
        <Stat label="Plans" value={String(r.plans.length)} />
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Activity heatmap (this project)</h2>
          <Heatmap data={r.heat} />
        </div>
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Category mix</h2>
          <ul className="space-y-1 text-sm">
            {r.cats.slice(0, 10).map((c: any) => {
              const pct = (c.n / totalCats) * 100;
              return (
                <li key={c.category} className="space-y-0.5">
                  <Link href={`/prompts?project=${encodeURIComponent(r.project.id)}&cat=${encodeURIComponent(c.category)}`}
                        className="flex justify-between hover:text-accent">
                    <span>{c.category}</span>
                    <span className="text-mutedfg tabular-nums">{c.n} · {pct.toFixed(0)}%</span>
                  </Link>
                  <div className="h-1 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-accent/60" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Top sessions</h2>
          <ul className="space-y-1 text-sm">
            {r.topSessions.map((s: any) => (
              <li key={s.id}>
                <Link className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/60" href={`/sessions/${s.id}`}>
                  <span className="text-[11px] text-mutedfg tabular-nums w-20">{fmtDate(s.started_at).slice(0, 10)}</span>
                  <span className="text-accent truncate flex-1 min-w-0">{s.slug || s.id.slice(0, 8)}</span>
                  {s.plan_slug && <span className="text-[10px] bg-accent/20 text-accent rounded px-1.5 py-0.5">plan</span>}
                  <span className="text-xs text-mutedfg tabular-nums w-12 text-right">{s.turn_count}t</span>
                  <span className="text-xs text-mutedfg tabular-nums w-14 text-right">{fmtTokens(s.out_tok || 0)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Plans produced</h2>
          {r.plans.length === 0 ? (
            <div className="text-xs text-mutedfg">No plans written in this project.</div>
          ) : (
            <ul className="space-y-1 text-sm">
              {r.plans.map((p: any) => (
                <li key={p.slug}>
                  <Link className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/60"
                        href={`/plans/${encodeURIComponent(p.slug)}`}>
                    <span className="flex-1 truncate">{p.title || p.slug}</span>
                    <span className="text-[11px] text-mutedfg tabular-nums">{p.word_count}w</span>
                    <span className="text-[11px] text-mutedfg">{fmtRelative(p.mtime)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {r.slashes.length > 0 && (
            <>
              <h2 className="text-sm font-medium mt-5 mb-2">Top slash commands</h2>
              <div className="flex flex-wrap gap-1">
                {r.slashes.map((s: any) => (
                  <span key={s.slash_name} className="text-[11px] rounded border border-border px-2 py-0.5">
                    <span className="text-accent">/{s.slash_name}</span> <span className="text-mutedfg tabular-nums">{s.n}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <div className="text-xs text-mutedfg">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-mutedfg mt-0.5">{sub}</div>}
    </div>
  );
}
