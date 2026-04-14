import Link from "next/link";
import { weekDigest } from "@/lib/queries";
import { fmtDate, fmtRelative, truncate, basename } from "@/lib/utils";
import { fmtTokens, fmtCost, costUSD } from "@/lib/pricing";

export const dynamic = "force-dynamic";

// Compute Monday-start of the ISO week containing the given UTC Date
function mondayOf(d: Date): Date {
  const dd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dd.getUTCDay() || 7; // 1..7 with Mon=1
  dd.setUTCDate(dd.getUTCDate() - (day - 1));
  return dd;
}
function isoWeekKey(d: Date): string {
  // yyyy-Www (ISO week number). Quick and portable.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}
function parseStart(s: string | undefined): Date {
  if (s) {
    // Expected yyyy-mm-dd (Monday) or yyyy-Www
    const m = /^(\d{4})-W(\d{2})$/.exec(s);
    if (m) {
      const year = Number(m[1]); const wk = Number(m[2]);
      // Monday of ISO week
      const simple = new Date(Date.UTC(year, 0, 1 + (wk - 1) * 7));
      const dow = simple.getUTCDay() || 7;
      const iso = new Date(simple); iso.setUTCDate(simple.getUTCDate() - (dow - 1) + (dow <= 4 ? 0 : 7));
      return mondayOf(iso);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return mondayOf(new Date(s + "T00:00:00Z"));
    }
  }
  return mondayOf(new Date());
}

export default async function WeekPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const start = parseStart(sp.w);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 7);
  const prevStart = new Date(start); prevStart.setUTCDate(prevStart.getUTCDate() - 7);
  const nextStart = new Date(start); nextStart.setUTCDate(nextStart.getUTCDate() + 7);

  const thisWeek = weekDigest(+start, +end);
  const lastWeek = weekDigest(+prevStart, +start);
  const cost = costUSD(thisWeek.tokens.model, thisWeek.tokens.input || 0, thisWeek.tokens.output || 0, thisWeek.tokens.cache_creation || 0, thisWeek.tokens.cache_read || 0);
  const lastCost = costUSD(lastWeek.tokens.model, lastWeek.tokens.input || 0, lastWeek.tokens.output || 0, lastWeek.tokens.cache_creation || 0, lastWeek.tokens.cache_read || 0);
  const totalTokens = (thisWeek.tokens.input || 0) + (thisWeek.tokens.output || 0) + (thisWeek.tokens.cache_creation || 0) + (thisWeek.tokens.cache_read || 0);
  const lastTotal = (lastWeek.tokens.input || 0) + (lastWeek.tokens.output || 0) + (lastWeek.tokens.cache_creation || 0) + (lastWeek.tokens.cache_read || 0);
  const wkLabel = `${isoWeekKey(start)} · ${start.toISOString().slice(0,10)} → ${new Date(+end - 86400000).toISOString().slice(0,10)}`;
  const totalCats = thisWeek.cats.reduce((s: number, c: any) => s + c.n, 0);
  const maxDayN = Math.max(1, ...thisWeek.perDay.map(d => d.n));

  // Fill 7 days (Mon..Sun) for the bar strip
  const perDayMap = new Map(thisWeek.perDay.map(d => [d.d, d.n]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(start); dt.setUTCDate(dt.getUTCDate() + i);
    const key = dt.toISOString().slice(0, 10);
    return { d: key, n: perDayMap.get(key) || 0, label: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i] };
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Week</h1>
          <p className="text-sm text-mutedfg">{wkLabel}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link className="px-2 py-1 rounded border border-border hover:bg-muted/60" href={`/week?w=${prevStart.toISOString().slice(0,10)}`}>← prev</Link>
          <Link className="px-2 py-1 rounded border border-accent/50 text-accent hover:bg-accent/10" href="/week">this week</Link>
          <Link className="px-2 py-1 rounded border border-border hover:bg-muted/60" href={`/week?w=${nextStart.toISOString().slice(0,10)}`}>next →</Link>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card label="Prompts" value={(thisWeek.counts.prompts || 0).toLocaleString()} delta={delta(thisWeek.counts.prompts, lastWeek.counts.prompts)} />
        <Card label="Sessions" value={(thisWeek.counts.sessions || 0).toLocaleString()} delta={delta(thisWeek.counts.sessions, lastWeek.counts.sessions)} />
        <Card label="Active days" value={`${thisWeek.counts.active_days || 0} / 7`} />
        <Card label="Tokens" value={fmtTokens(totalTokens)} delta={delta(totalTokens, lastTotal, true)} />
        <Card label="Cost" value={fmtCost(cost)} delta={deltaCost(cost, lastCost)} />
      </section>

      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">Prompts per day</h2>
        <div className="flex items-end gap-3 h-28">
          {days.map(d => {
            const h = (d.n / maxDayN) * 100;
            return (
              <Link key={d.d} href={`/today?d=${d.d}`}
                className="flex-1 flex flex-col items-center gap-1 hover:text-accent group">
                <div className="w-full flex items-end" style={{ height: "80%" }}>
                  <div className="w-full rounded-t bg-accent/60 group-hover:bg-accent transition"
                       style={{ height: `${h}%`, minHeight: d.n ? 2 : 0 }}
                       title={`${d.d} — ${d.n}`} />
                </div>
                <div className="text-[10px] text-mutedfg tabular-nums">{d.label} · {d.n}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Top projects this week</h2>
          <ul className="space-y-1 text-sm">
            {thisWeek.topProjects.map((p: any) => (
              <li key={p.id}>
                <Link className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-muted/60" href={`/projects/${encodeURIComponent(p.id)}`}>
                  <span className="truncate">{basename(p.cwd || p.id)}</span>
                  <span className="text-xs text-mutedfg tabular-nums">{p.prompts}</span>
                </Link>
              </li>
            ))}
            {thisWeek.topProjects.length === 0 && <li className="text-xs text-mutedfg">—</li>}
          </ul>
          <h2 className="text-sm font-medium mt-4 mb-2">Categories</h2>
          <div className="flex flex-wrap gap-1">
            {thisWeek.cats.slice(0, 14).map((c: any) => {
              const pct = totalCats ? (c.n / totalCats) * 100 : 0;
              return (
                <Link key={c.category}
                  className="text-[11px] rounded border border-border px-2 py-0.5 hover:bg-muted/60"
                  href={`/prompts?cat=${encodeURIComponent(c.category)}&from=${+start}&to=${+end}`}>
                  {c.category} <span className="text-mutedfg tabular-nums">{c.n} · {pct.toFixed(0)}%</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Top sessions this week</h2>
          <ul className="space-y-1 text-sm">
            {thisWeek.topSessions.map((s: any) => (
              <li key={s.id}>
                <Link className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/60" href={`/sessions/${s.id}`}>
                  <span className="text-[11px] text-mutedfg tabular-nums w-20">{fmtDate(s.started_at).slice(0, 10)}</span>
                  <span className="text-accent truncate flex-1 min-w-0">{s.slug || s.id.slice(0, 8)}</span>
                  <span className="text-[11px] text-mutedfg truncate max-w-[160px]">{basename(s.cwd || "")}</span>
                  <span className="text-xs text-mutedfg tabular-nums w-10 text-right">{s.week_prompts}p</span>
                  <span className="text-xs text-mutedfg tabular-nums w-14 text-right">{fmtTokens(s.week_out || 0)}</span>
                </Link>
              </li>
            ))}
            {thisWeek.topSessions.length === 0 && <li className="text-xs text-mutedfg">—</li>}
          </ul>
          {thisWeek.plans.length > 0 && (
            <>
              <h2 className="text-sm font-medium mt-4 mb-2">Plans written this week</h2>
              <ul className="space-y-1 text-sm">
                {thisWeek.plans.map((p: any) => (
                  <li key={p.slug}>
                    <Link className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted/60" href={`/plans/${encodeURIComponent(p.slug)}`}>
                      <span className="truncate">{p.title || p.slug}</span>
                      <span className="text-xs text-mutedfg">{fmtRelative(p.mtime)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function delta(a: number, b: number, tokens = false): string {
  const ax = a || 0, bx = b || 0;
  if (!bx) return "";
  const diff = ax - bx;
  const pct = (diff / bx) * 100;
  const sign = diff >= 0 ? "+" : "";
  const v = tokens ? (fmtTokensSign(diff)) : `${sign}${diff.toLocaleString()}`;
  return `${v} (${sign}${pct.toFixed(0)}%) vs last week`;
}
function fmtTokensSign(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${sign}${(a / 1_000).toFixed(0)}K`;
  return `${sign}${a}`;
}
function deltaCost(a: number, b: number): string {
  if (!b) return "";
  const diff = a - b;
  const sign = diff >= 0 ? "+" : "-";
  return `${sign}${fmtCost(Math.abs(diff))} vs last week`;
}

function Card({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <div className="text-xs text-mutedfg">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {delta && <div className="text-[10px] text-mutedfg mt-0.5">{delta}</div>}
    </div>
  );
}
