import { db } from "@/lib/db";
import { slashHistogram, weeklyCounts, stopReasonStats } from "@/lib/queries";
import { WeeklyChart } from "@/components/WeeklyChart";
import { SlashChart } from "@/components/SlashChart";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  const weekly = weeklyCounts();
  const slash = slashHistogram().slice(0, 20);
  const permMix = db().prepare(`
    SELECT permission_mode, COUNT(*) n FROM sessions WHERE permission_mode IS NOT NULL GROUP BY permission_mode ORDER BY n DESC
  `).all() as any[];
  const entry = db().prepare(`
    SELECT entrypoint, COUNT(*) n FROM sessions WHERE entrypoint IS NOT NULL GROUP BY entrypoint ORDER BY n DESC
  `).all() as any[];
  const avgLen = db().prepare(`
    SELECT strftime('%Y-%W', ts/1000, 'unixepoch') AS wk, ROUND(AVG(char_count)) AS avgc
    FROM prompts WHERE ts>0 GROUP BY wk ORDER BY wk ASC
  `).all() as any[];

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-mutedfg">Slashes, sessions, trends.</p>
      </header>
      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Prompts per week</h2>
          <WeeklyChart data={weekly} />
        </div>
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Avg prompt length per week (chars)</h2>
          <WeeklyChart data={avgLen.map((r: any) => ({ wk: r.wk, n: r.avgc }))} />
        </div>
      </section>
      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">Top slash commands</h2>
        <SlashChart data={slash} />
      </section>
      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">Stop reasons</h2>
        <p className="text-[11px] text-mutedfg mb-3">Why the model stopped each turn. <code>end_turn</code> = normal completion. <code>tool_use</code> = paused to call a tool (most common). <code>max_tokens</code> = hit the response cap. Anything weird signals trouble.</p>
        <ul className="grid md:grid-cols-2 gap-1.5 text-sm">
          {stopReasonStats().map(r => {
            const tone = r.stop_reason === "end_turn" ? "text-emerald-300"
                       : r.stop_reason === "tool_use" ? "text-cyan-300"
                       : r.stop_reason === "max_tokens" ? "text-amber-300"
                       : "text-mutedfg";
            return (
              <li key={r.stop_reason} className="flex justify-between rounded border border-border px-3 py-1.5">
                <code className={tone}>{r.stop_reason}</code>
                <span className="tabular-nums">{r.n.toLocaleString()}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Permission mode</h2>
          <ul className="space-y-1 text-sm">
            {permMix.map(p => (
              <li key={p.permission_mode} className="flex justify-between">
                <span className="text-mutedfg">{p.permission_mode}</span>
                <span className="tabular-nums">{p.n}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Entrypoint</h2>
          <ul className="space-y-1 text-sm">
            {entry.map(p => (
              <li key={p.entrypoint} className="flex justify-between">
                <span className="text-mutedfg">{p.entrypoint}</span>
                <span className="tabular-nums">{p.n}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
