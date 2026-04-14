import Link from "next/link";
import { slashSuccessMetrics } from "@/lib/queries";
import { fmtRelative } from "@/lib/utils";
import { fmtDuration } from "@/lib/bursts";

export const dynamic = "force-dynamic";

export default function SlashesPage() {
  const rows = slashSuccessMetrics();
  const total = rows.reduce((s, r) => s + r.uses, 0);

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <header>
        <h1 className="text-2xl font-semibold">Slash command success</h1>
        <p className="text-sm text-mutedfg">
          {total.toLocaleString()} slash invocations across {rows.length} unique commands. Quick-follow % = how often you wrote another prompt within 60s
          (often a sign the slash didn't fully do the job). Terminal % = how often the slash was your last prompt of the session.
        </p>
      </header>
      <section className="rounded-lg border border-border bg-card/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-mutedfg sticky top-0 bg-card/80 backdrop-blur">
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 w-12">#</th>
              <th className="text-left px-3 py-2">slash</th>
              <th className="text-right px-3 py-2 w-16">uses</th>
              <th className="text-right px-3 py-2 w-28">quick-follow</th>
              <th className="text-right px-3 py-2 w-24">median gap</th>
              <th className="text-right px-3 py-2 w-24">terminal</th>
              <th className="text-right px-3 py-2 w-24">last used</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const qfTone = r.quick_follow_pct >= 0.5 ? "text-amber-300"
                           : r.quick_follow_pct >= 0.3 ? "text-yellow-300"
                           : "text-emerald-300";
              return (
                <tr key={r.name} className="border-b border-border/60 hover:bg-muted/40">
                  <td className="px-3 py-1.5 text-mutedfg tabular-nums">{i + 1}</td>
                  <td className="px-3 py-1.5">
                    <Link className="text-accent hover:underline font-mono" href={`/prompts?slash=1&q=${encodeURIComponent("/" + r.name)}`}>/{r.name}</Link>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.uses}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${qfTone}`}>
                    {(r.quick_follow_pct * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-mutedfg">
                    {r.median_gap_ms ? fmtDuration(r.median_gap_ms) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-mutedfg">{(r.terminal_pct * 100).toFixed(0)}%</td>
                  <td className="px-3 py-1.5 text-right text-[11px] text-mutedfg whitespace-nowrap">{fmtRelative(r.last_ts)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
