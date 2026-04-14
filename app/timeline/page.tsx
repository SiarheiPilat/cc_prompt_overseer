import Link from "next/link";
import { db } from "@/lib/db";
import { heatmapData, heatmapTopSessions, weeklyCounts } from "@/lib/queries";
import { Heatmap } from "@/components/Heatmap";
import { WeeklyChart } from "@/components/WeeklyChart";
import { fmtDate, truncate, basename } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function TimelinePage() {
  const heat = heatmapData();
  const weekly = weeklyCounts();
  const days = db().prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d, COUNT(*) n
    FROM prompts WHERE ts>0 GROUP BY d ORDER BY d DESC LIMIT 40
  `).all() as any[];

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Timeline</h1>
        <p className="text-sm text-mutedfg">When you use Claude Code, across time.</p>
      </header>
      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Day × hour heatmap (UTC) <span className="text-[10px] text-mutedfg font-normal">— hover for top sessions</span></h2>
          <Heatmap data={heat} topSessions={heatmapTopSessions()} />
        </div>
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Prompts per week</h2>
          <WeeklyChart data={weekly} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">Recent days</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2">
          {days.map(d => (
            <Link key={d.d} href={`/prompts?from=${Date.parse(d.d + "T00:00:00Z")}&to=${Date.parse(d.d + "T23:59:59Z")}`}
                  className="flex items-center justify-between rounded px-3 py-2 border border-border hover:bg-muted/60 text-sm">
              <span className="tabular-nums">{d.d}</span>
              <span className="text-mutedfg tabular-nums">{d.n}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
