import Link from "next/link";
import { anomalies } from "@/lib/queries";
import { fmtDate, truncate, basename } from "@/lib/utils";
import { fmtTokens } from "@/lib/pricing";
import { fmtDuration } from "@/lib/bursts";
import { TriangleAlert, Clock, Bug, Database, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AnomaliesPage() {
  const a = anomalies();
  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <header>
        <h1 className="text-2xl font-semibold">Anomalies</h1>
        <p className="text-sm text-mutedfg">
          Spikes, spirals, and red flags across your history. Mean prompts/day: {a.stats.mean.toFixed(1)} · σ: {a.stats.sigma.toFixed(1)} · threshold: {a.stats.threshold.toFixed(0)} prompts over {a.stats.totalDays} days.
        </p>
      </header>

      <Section title="Spike days" Icon={TriangleAlert} hint="days where you wrote more than mean + 2σ prompts">
        {a.spikeDays.length === 0 ? <Empty /> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-mutedfg">
              <tr><th className="text-left">date</th><th className="text-right">prompts</th><th className="text-right">σ above mean</th><th></th></tr>
            </thead>
            <tbody>
              {a.spikeDays.map(d => (
                <tr key={d.d} className="border-t border-border/50">
                  <td className="py-1.5 tabular-nums">{d.d}</td>
                  <td className="text-right tabular-nums">{d.n}</td>
                  <td className="text-right tabular-nums text-accent">+{d.deviation.toFixed(1)}σ</td>
                  <td className="text-right">
                    <Link className="text-xs text-accent hover:underline"
                          href={`/prompts?from=${Date.parse(d.d + "T00:00:00Z")}&to=${Date.parse(d.d + "T23:59:59Z")}`}>
                      see prompts →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Marathon sessions" Icon={Clock} hint="wall-clock duration > 4 hours">
        {a.marathons.length === 0 ? <Empty /> : (
          <ul className="space-y-1 text-sm">
            {a.marathons.map((m: any) => (
              <li key={m.id}>
                <Link className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/60" href={`/sessions/${m.id}`}>
                  <span className="text-xs text-mutedfg tabular-nums w-28">{fmtDate(m.started_at)}</span>
                  <span className="text-accent truncate flex-1 min-w-0">{m.slug || m.id.slice(0, 8)}</span>
                  <span className="text-xs text-mutedfg truncate max-w-[200px]">{basename(m.cwd || "")}</span>
                  <span className="text-xs tabular-nums w-14 text-right">{m.turn_count}t</span>
                  <span className="text-xs text-mutedfg tabular-nums w-16 text-right">{fmtTokens(m.out_tok || 0)}</span>
                  <span className="text-accent tabular-nums w-16 text-right">{fmtDuration(m.ended_at - m.started_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Debug spirals" Icon={Bug} hint="sessions where > 15 prompts were categorized as debug or fix">
        {a.spirals.length === 0 ? <Empty /> : (
          <ul className="space-y-1 text-sm">
            {a.spirals.map((s: any) => {
              const ratio = s.total_count ? (s.debug_count / s.total_count) : 0;
              return (
                <li key={s.id}>
                  <Link className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/60" href={`/sessions/${s.id}`}>
                    <span className="text-accent truncate flex-1 min-w-0">{s.slug || s.id.slice(0, 8)}</span>
                    <span className="text-xs text-mutedfg truncate max-w-[220px]">{basename(s.cwd || "")}</span>
                    <span className="text-xs tabular-nums w-28 text-right">{s.debug_count} / {s.total_count} · {(ratio * 100).toFixed(0)}%</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Low cache hit rate" Icon={Database} hint="sessions with > 50K cache writes but < 30% read-to-write ratio — you're paying to write cache entries you never reuse">
        {a.lowCache.length === 0 ? <Empty /> : (
          <ul className="space-y-1 text-sm">
            {a.lowCache.map((s: any) => {
              const hit = s.cr / Math.max(1, s.cr + s.cw);
              return (
                <li key={s.id}>
                  <Link className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/60" href={`/sessions/${s.id}`}>
                    <span className="text-accent truncate flex-1 min-w-0">{s.slug || s.id.slice(0, 8)}</span>
                    <span className="text-xs text-mutedfg truncate max-w-[220px]">{basename(s.cwd || "")}</span>
                    <span className="text-xs text-mutedfg tabular-nums w-20 text-right">{fmtTokens(s.cw)} wr</span>
                    <span className="text-xs text-mutedfg tabular-nums w-20 text-right">{fmtTokens(s.cr)} rd</span>
                    <span className="text-accent tabular-nums w-14 text-right">{(hit * 100).toFixed(0)}%</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Rage prompts" Icon={Zap} hint="ALL CAPS ≥ 15 letters, or ≥ 3 exclamation marks — moments of frustration">
        {a.rage.length === 0 ? <Empty /> : (
          <ul className="space-y-1 text-sm">
            {a.rage.map((p: any) => (
              <li key={p.id}>
                <Link className="flex items-start gap-3 rounded p-2 hover:bg-muted/60 border border-transparent hover:border-border"
                      href={`/sessions/${p.session_id}#p${p.id}`}>
                  <span className="text-xs text-mutedfg w-20 tabular-nums pt-0.5">{fmtDate(p.ts).slice(0, 10)}</span>
                  <span className="font-mono text-[12px] line-clamp-2 flex-1 min-w-0">{truncate((p.text || "").replace(/\s+/g, " "), 240)}</span>
                  <span className="text-xs text-accent tabular-nums shrink-0">{"!".repeat(Math.min(5, p.excl))}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, Icon, hint, children }: { title: string; Icon: any; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card/60 p-4">
      <div className="flex items-baseline gap-2 mb-3">
        <Icon className="h-4 w-4 text-accent shrink-0" />
        <h2 className="text-sm font-medium">{title}</h2>
        {hint && <span className="text-[11px] text-mutedfg">· {hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty() {
  return <div className="text-xs text-mutedfg">Nothing flagged — clean sailing.</div>;
}
