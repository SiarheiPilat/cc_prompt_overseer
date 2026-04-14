import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, getSessionsForProject } from "@/lib/queries";
import { fmtDate, fmtRelative, truncate } from "@/lib/utils";
import { fmtCost, fmtTokens, costUSD } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProject(decodeURIComponent(id)) as any;
  if (!p) return notFound();
  const sessions = getSessionsForProject(decodeURIComponent(id)) as any[];
  const totalCost = sessions.reduce((sum, s) =>
    sum + costUSD(s.model, s.in_tok || 0, s.out_tok || 0, s.cw_tok || 0, s.cr_tok || 0), 0);
  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <div className="text-xs text-mutedfg">project</div>
          <h1 className="text-xl font-semibold break-words">{p.cwd || p.id}</h1>
          <div className="text-xs text-mutedfg mt-1">
            {p.prompt_count} prompts · {p.session_count} sessions · {fmtCost(totalCost)} estimated
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/projects/${encodeURIComponent(p.id)}/report`} className="text-sm px-3 py-1.5 rounded border border-border hover:bg-muted/60">
            report card →
          </Link>
          <Link href={`/prompts?project=${encodeURIComponent(p.id)}`} className="text-sm bg-accent/20 text-accent px-3 py-1.5 rounded hover:bg-accent/30">
            all prompts →
          </Link>
        </div>
      </header>
      <ul className="rounded-lg border border-border bg-card/60 divide-y divide-border">
        {sessions.map(s => (
          <li key={s.id}>
            <Link className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 text-sm" href={`/sessions/${s.id}`}>
              <div className="text-xs text-mutedfg tabular-nums w-40">{fmtDate(s.started_at)}</div>
              <div className="flex-1 min-w-0 truncate">
                <span className="text-accent">{s.slug || s.id.slice(0, 8)}</span>
                {s.plan_slug && <span className="ml-2 text-[10px] bg-accent/20 text-accent rounded px-1.5 py-0.5">plan</span>}
              </div>
              <div className="text-xs text-mutedfg tabular-nums">{s.prompt_count}p · {s.turn_count}t</div>
              <div className="text-xs text-mutedfg tabular-nums w-16 text-right" title={`${s.in_tok || 0} in / ${s.out_tok || 0} out / ${s.cr_tok || 0} cached`}>
                {s.out_tok ? fmtTokens(s.out_tok) : ""}
              </div>
              <div className="text-xs tabular-nums w-16 text-right text-fg">
                {fmtCost(costUSD(s.model, s.in_tok || 0, s.out_tok || 0, s.cw_tok || 0, s.cr_tok || 0))}
              </div>
              {s.permission_mode && <div className="text-xs text-mutedfg w-20 text-right">{s.permission_mode}</div>}
              {s.ended_at && <div className="text-xs text-mutedfg">{fmtRelative(s.ended_at)}</div>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
