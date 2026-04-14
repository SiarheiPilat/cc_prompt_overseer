import Link from "next/link";
import { dayDigest } from "@/lib/queries";
import { costUSD, fmtCost, fmtTokens } from "@/lib/pricing";
import { fmtDate, fmtRelative, truncate, basename } from "@/lib/utils";

export const dynamic = "force-dynamic";

function isoDay(d: Date) { return d.toISOString().slice(0, 10); }

export default async function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const now = new Date();
  const todayISO = sp.d || isoDay(now);
  const start = Date.parse(todayISO + "T00:00:00Z");
  const end = start + 86400000;
  const prev = isoDay(new Date(start - 86400000));
  const next = isoDay(new Date(end));

  const today = dayDigest(start, end);
  const yesterday = dayDigest(start - 86400000, start);
  const cost = costUSD(today.tokens.model, today.tokens.input || 0, today.tokens.output || 0, today.tokens.cache_creation || 0, today.tokens.cache_read || 0);
  const yCost = costUSD(yesterday.tokens.model, yesterday.tokens.input || 0, yesterday.tokens.output || 0, yesterday.tokens.cache_creation || 0, yesterday.tokens.cache_read || 0);
  const totalTokens = (today.tokens.input || 0) + (today.tokens.output || 0) + (today.tokens.cache_creation || 0) + (today.tokens.cache_read || 0);
  const isToday = todayISO === isoDay(now);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{isToday ? "Today" : todayISO}</h1>
          <p className="text-sm text-mutedfg">What you worked on. UTC day. Use ← → to navigate.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link className="px-2 py-1 rounded border border-border hover:bg-muted/60" href={`/today?d=${prev}`}>← {prev}</Link>
          {!isToday && <Link className="px-2 py-1 rounded border border-accent/50 text-accent hover:bg-accent/10" href="/today">today</Link>}
          <Link className="px-2 py-1 rounded border border-border hover:bg-muted/60" href={`/today?d=${next}`}>{next} →</Link>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card label="Prompts" value={(today.counts.prompts || 0).toLocaleString()} delta={delta(today.counts.prompts, yesterday.counts.prompts)} />
        <Card label="Sessions" value={(today.counts.sessions || 0).toLocaleString()} delta={delta(today.counts.sessions, yesterday.counts.sessions)} />
        <Card label="Chars written" value={fmtTokens(today.counts.chars || 0)} delta={delta(today.counts.chars, yesterday.counts.chars)} />
        <Card label="Tokens" value={fmtTokens(totalTokens)} sub={`${fmtTokens(today.tokens.output || 0)} out`} />
        <Card label="Cost" value={fmtCost(cost)} delta={deltaCost(cost, yCost)} />
      </section>

      {today.counts.prompts === 0 && (
        <div className="rounded-lg border border-border bg-card/60 p-6 text-sm text-mutedfg">
          Nothing logged for {todayISO}. {isToday ? "Go write a prompt — come back and refresh." : "Try a different day."}
        </div>
      )}

      {today.counts.prompts > 0 && (
        <>
          <section className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card/60 p-4">
              <h2 className="text-sm font-medium mb-3">Sessions ({today.sessions.length})</h2>
              <ul className="space-y-1 text-sm">
                {today.sessions.map(s => {
                  const dur = s.last_ts && s.first_ts ? Math.round((s.last_ts - s.first_ts) / 60000) : 0;
                  return (
                    <li key={s.id}>
                      <Link className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/60" href={`/sessions/${s.id}`}>
                        <span className="text-xs text-mutedfg w-12 tabular-nums">{fmtDate(s.first_ts).slice(11, 16)}</span>
                        <span className="text-accent truncate flex-1 min-w-0">{s.slug || s.id.slice(0, 8)}</span>
                        <span className="text-xs text-mutedfg truncate max-w-[180px]">{basename(s.cwd || "")}</span>
                        <span className="text-xs text-mutedfg tabular-nums w-14 text-right">{s.day_prompts}p</span>
                        <span className="text-xs text-mutedfg tabular-nums w-14 text-right">{dur}m</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-4">
              <h2 className="text-sm font-medium mb-3">Projects worked in</h2>
              <ul className="space-y-1 text-sm">
                {today.projects.map(p => (
                  <li key={p.id}>
                    <Link className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-muted/60" href={`/projects/${encodeURIComponent(p.id)}`}>
                      <span className="truncate">{basename(p.cwd || p.id)}</span>
                      <span className="text-xs text-mutedfg tabular-nums">{p.prompts}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <h2 className="text-sm font-medium mt-5 mb-2">Categories</h2>
              <div className="flex flex-wrap gap-1">
                {today.cats.map(c => (
                  <Link key={c.category}
                    className="text-[11px] rounded border border-border px-2 py-0.5 hover:bg-muted/60"
                    href={`/prompts?cat=${encodeURIComponent(c.category)}&from=${start}&to=${end}`}>
                    {c.category} <span className="text-mutedfg tabular-nums">{c.n}</span>
                  </Link>
                ))}
              </div>
              {today.plans.length > 0 && (
                <>
                  <h2 className="text-sm font-medium mt-5 mb-2">Plans written/modified today</h2>
                  <ul className="space-y-1 text-sm">
                    {today.plans.map(p => (
                      <li key={p.slug}>
                        <Link className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted/60"
                              href={`/plans/${encodeURIComponent(p.slug)}`}>
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

          <section className="rounded-lg border border-border bg-card/60 p-4">
            <h2 className="text-sm font-medium mb-3">All prompts from this day ({today.recentPrompts.length} of {today.counts.prompts})</h2>
            <ul className="space-y-1 text-sm">
              {today.recentPrompts.map(r => (
                <li key={r.id}>
                  <Link href={`/sessions/${r.session_id}#p${r.id}`}
                    className="flex items-start gap-3 rounded px-2 py-1.5 hover:bg-muted/60 border border-transparent hover:border-border">
                    <span className="text-xs text-mutedfg tabular-nums w-12 shrink-0 pt-0.5">{fmtDate(r.ts).slice(11, 16)}</span>
                    {r.is_slash ? (
                      <span className="text-[10px] text-accent shrink-0 mt-1">/{r.slash_name}</span>
                    ) : (
                      <span className="text-[10px] text-mutedfg shrink-0 mt-1 w-14 truncate">{r.category}</span>
                    )}
                    <span className="font-mono text-[12px] flex-1 min-w-0 break-words line-clamp-2">{truncate((r.snippet || "").replace(/\s+/g," "), 280)}</span>
                    <span className="text-[10px] text-mutedfg tabular-nums shrink-0 pt-0.5">{r.char_count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function delta(a: number, b: number): string {
  const ax = a || 0, bx = b || 0;
  if (!bx) return "";
  const diff = ax - bx;
  const pct = (diff / bx) * 100;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toLocaleString()} (${sign}${pct.toFixed(0)}%) vs yday`;
}
function deltaCost(a: number, b: number): string {
  if (!b) return "";
  const diff = a - b;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${fmtCost(diff)} vs yday`;
}

function Card({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <div className="text-xs text-mutedfg">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-mutedfg mt-0.5">{sub}</div>}
      {delta && <div className="text-[10px] text-mutedfg mt-0.5">{delta}</div>}
    </div>
  );
}
