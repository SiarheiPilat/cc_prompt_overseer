import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlan, planFollowups, getAdjacentPlans } from "@/lib/queries";
import { fmtDate, fmtRelative, truncate } from "@/lib/utils";
import { PlanView } from "@/components/PlanView";
import { parsePlanProgress } from "@/lib/plan-progress";
import { PlanMetaPanel } from "@/components/PlanMetaPanel";
import { CheckSquare, Square } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPlan(decodeURIComponent(slug)) as any;
  if (!p) return notFound();
  const progress = parsePlanProgress(p.body || "");
  const followups = planFollowups(p.slug, p.mtime || 0, 30);
  const { prev: prevPlan, next: nextPlan } = getAdjacentPlans(p.slug);
  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-mutedfg">{p.slug} · {fmtDate(p.mtime)} · {p.word_count} words</div>
          <h1 className="text-2xl font-semibold mt-1 break-words">{p.title}</h1>
          {progress.hasCheckboxes && (
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="text-mutedfg">progress:</span>
              <div className="w-40 h-1.5 rounded bg-muted overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${progress.percent * 100}%` }} />
              </div>
              <span className="tabular-nums text-fg">{progress.done}/{progress.total} · {(progress.percent * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0 items-center">
          <PlanMetaPanel slug={p.slug} />
          {p.linked_session_id && (
            <Link className="text-sm bg-accent/20 text-accent px-3 py-1.5 rounded hover:bg-accent/30"
                  href={`/sessions/${p.linked_session_id}`}>open session →</Link>
          )}
          <Link className="text-sm px-3 py-1.5 rounded border border-border hover:bg-muted/60" href="/plans">← all plans</Link>
        </div>
      </header>
      {progress.hasCheckboxes && progress.nextItems.length > 0 && (
        <section className="rounded-lg border border-accent/30 bg-accent/5 p-4">
          <h2 className="text-sm font-medium mb-2">Next ({progress.nextItems.length} of {progress.total - progress.done} remaining)</h2>
          <ul className="space-y-1">
            {progress.nextItems.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Square className="h-3.5 w-3.5 mt-0.5 text-mutedfg shrink-0" />
                <span>{it.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(prevPlan || nextPlan) && (
        <nav className="flex items-center justify-between gap-2 text-xs">
          <div className="flex-1 min-w-0">
            {prevPlan ? (
              <Link href={`/plans/${encodeURIComponent(prevPlan.slug)}`}
                    className="block rounded border border-border hover:border-accent/50 hover:bg-muted/40 px-3 py-2 transition">
                <div className="text-mutedfg">← previous plan</div>
                <div className="text-fg truncate">
                  <span className="text-accent">{truncate(prevPlan.title || prevPlan.slug, 60)}</span>
                  <span className="ml-2 text-mutedfg">{fmtRelative(prevPlan.mtime)} · {prevPlan.word_count}w</span>
                </div>
              </Link>
            ) : <div />}
          </div>
          <div className="flex-1 min-w-0">
            {nextPlan ? (
              <Link href={`/plans/${encodeURIComponent(nextPlan.slug)}`}
                    className="block rounded border border-border hover:border-accent/50 hover:bg-muted/40 px-3 py-2 transition text-right">
                <div className="text-mutedfg">next plan →</div>
                <div className="text-fg truncate">
                  <span className="text-accent">{truncate(nextPlan.title || nextPlan.slug, 60)}</span>
                  <span className="ml-2 text-mutedfg">{fmtRelative(nextPlan.mtime)} · {nextPlan.word_count}w</span>
                </div>
              </Link>
            ) : <div />}
          </div>
        </nav>
      )}

      <div className="rounded-lg border border-border bg-card/60 p-6">
        <PlanView body={p.body} />
      </div>

      {followups.length > 0 && (
        <section className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">
            Follow-up prompts in the linked session ({followups.length})
            <span className="ml-2 text-[11px] text-mutedfg font-normal">— what you said after this plan was written</span>
          </h2>
          <ul className="space-y-1">
            {followups.map((f: any) => (
              <Link key={f.id} href={`/sessions/${f.session_id}#p${f.id}`}
                    className="block rounded p-2 hover:bg-muted/40 border border-transparent hover:border-border">
                <div className="text-[11px] text-mutedfg flex gap-2">
                  <span className="tabular-nums">{fmtDate(f.ts).slice(11, 16)}</span>
                  {f.is_slash ? <span className="text-accent">/{f.slash_name}</span> : <span>{f.category || "—"}</span>}
                  <span className="ml-auto tabular-nums">{f.char_count} ch</span>
                </div>
                <div className="text-[12px] font-mono mt-0.5 line-clamp-2">{truncate((f.snippet || "").replace(/\s+/g, " "), 280)}</div>
              </Link>
            ))}
          </ul>
        </section>
      )}

      <div className="text-xs text-mutedfg">file: <code>{p.path}</code></div>
    </div>
  );
}
