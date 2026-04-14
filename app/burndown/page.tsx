import Link from "next/link";
import { projectLifecycles } from "@/lib/queries";
import { fmtRelative, basename } from "@/lib/utils";
import { Sparkline } from "@/components/Sparkline";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  recent: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  cooling: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  dormant: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40",
};

export default function BurndownPage() {
  const projects = projectLifecycles(40);
  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <header>
        <h1 className="text-2xl font-semibold">Burndown</h1>
        <p className="text-sm text-mutedfg">
          When did each project start, when did activity peak, where is it now? Sparkline = daily prompts across the project's full lifetime.
          Status: active &lt; 7d · recent &lt; 30d · cooling &lt; 90d · dormant.
        </p>
      </header>
      <div className="grid md:grid-cols-2 gap-3">
        {projects.map((p: any) => {
          const intensity = Math.min(1, (p.active_days / p.span_days));
          return (
            <Link key={p.id} href={`/projects/${encodeURIComponent(p.id)}/report`}
              className="rounded-lg border border-border bg-card/60 p-4 hover:border-accent/60 transition flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <span className="font-medium truncate flex-1 min-w-0">{basename(p.cwd || p.id)}</span>
                <span className={`text-[10px] uppercase rounded border px-1.5 py-0.5 ${STATUS_STYLE[p.status]}`}>{p.status}</span>
              </div>
              <div className="text-[11px] text-mutedfg truncate">{p.cwd}</div>
              <div className="grid grid-cols-4 gap-2 text-[11px]">
                <Mini label="prompts" value={p.prompt_count.toLocaleString()} />
                <Mini label="span" value={`${p.span_days}d`} />
                <Mini label="active" value={`${p.active_days}d`} />
                <Mini label="density" value={`${(intensity * 100).toFixed(0)}%`} />
              </div>
              <Sparkline values={p.days} height={40} />
              <div className="text-[10px] text-mutedfg flex justify-between">
                <span>started {fmtRelative(p.first_seen)}</span>
                <span>last {fmtRelative(p.last_seen)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-mutedfg">{label}</div>
      <div className="tabular-nums">{value}</div>
    </div>
  );
}
