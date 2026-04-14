import Link from "next/link";
import { getProjects, recentDailyByProject } from "@/lib/queries";
import { fmtRelative, basename } from "@/lib/utils";
import { Sparkline } from "@/components/Sparkline";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  const projects = getProjects() as any[];
  const sparks = recentDailyByProject(30);
  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-mutedfg">{projects.length} working directories where Claude Code has run.</p>
      </header>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map(p => (
          <div key={p.id}
            className="rounded-lg border border-border bg-card/60 p-4 hover:border-accent/60 transition flex flex-col">
            <Link href={`/projects/${encodeURIComponent(p.id)}`} className="flex-1 min-w-0 block">
              <div className="text-xs text-mutedfg truncate">{p.cwd || "(unknown cwd)"}</div>
              <div className="font-medium mt-1 truncate">{basename(p.cwd || p.id)}</div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div><div className="text-mutedfg">prompts</div><div className="tabular-nums">{p.prompt_count}</div></div>
                <div><div className="text-mutedfg">sessions</div><div className="tabular-nums">{p.session_count}</div></div>
                <div><div className="text-mutedfg">plans</div><div className="tabular-nums">{p.plan_count ?? 0}</div></div>
              </div>
              {p.last_seen && <div className="text-[11px] text-mutedfg mt-2">last: {fmtRelative(p.last_seen)}</div>}
              <div className="mt-2">
                {(() => {
                  const series = sparks.get(p.id);
                  if (!series || series.every(v => v === 0)) {
                    return <div className="h-6 text-[10px] text-mutedfg">no activity in last 30 days</div>;
                  }
                  return <Sparkline values={series} height={28} />;
                })()}
              </div>
            </Link>
            <div className="mt-3 pt-3 border-t border-border flex gap-1 text-[11px]">
              <Link href={`/projects/${encodeURIComponent(p.id)}/report`}
                    className="rounded border border-border px-2 py-0.5 hover:bg-muted/80 hover:text-accent">report</Link>
              <Link href={`/prompts?project=${encodeURIComponent(p.id)}`}
                    className="rounded border border-border px-2 py-0.5 hover:bg-muted/80 hover:text-accent">prompts</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
