import Link from "next/link";
import { getPlans } from "@/lib/queries";
import { fmtRelative, truncate } from "@/lib/utils";
import { parsePlanProgress } from "@/lib/plan-progress";

export const dynamic = "force-dynamic";

function snippetAround(body: string, q: string, len = 200): string | null {
  if (!body || !q) return null;
  const idx = body.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return null;
  const start = Math.max(0, idx - 60);
  const end = Math.min(body.length, idx + q.length + (len - 60));
  return (start > 0 ? "…" : "") + body.slice(start, end).replace(/\s+/g, " ") + (end < body.length ? "…" : "");
}

export default async function PlansPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const plans = (getPlans(q) as any[]).map(p => ({ ...p, progress: parsePlanProgress(p.body || "") }));
  const totalCheckboxes = plans.reduce((s, p) => s + p.progress.total, 0);
  const totalDone = plans.reduce((s, p) => s + p.progress.done, 0);
  return (
    <div className="p-6 space-y-4">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Plans</h1>
          <p className="text-sm text-mutedfg">
            {plans.length} plan files {q && <>matching <span className="text-accent">"{q}"</span></>}
            {totalCheckboxes > 0 && <> · {totalDone}/{totalCheckboxes} checkbox items done</>}
          </p>
        </div>
        <form action="/plans" className="flex gap-2 items-center text-sm">
          <input type="text" name="q" defaultValue={q} placeholder="search title, body, slug…"
                 className="bg-muted rounded px-2 py-1.5 text-sm w-72 outline-none border border-transparent focus:border-accent/60" />
          <button className="bg-accent text-accentfg rounded px-3 py-1.5 text-sm hover:opacity-90">search</button>
          {q && <Link href="/plans" className="text-xs text-mutedfg hover:text-fg">clear</Link>}
        </form>
      </header>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.map(p => {
          const pr = p.progress;
          const snippet = q ? snippetAround(p.body || "", q) : null;
          return (
            <Link key={p.slug} href={`/plans/${encodeURIComponent(p.slug)}`}
              className="rounded-lg border border-border bg-card/60 p-4 hover:border-accent/60 hover:bg-muted/40 transition">
              <div className="text-xs text-mutedfg flex gap-2 mb-1">
                <span>{fmtRelative(p.mtime)}</span>
                <span>· {p.word_count} words</span>
                {pr.hasCheckboxes && (
                  <span className="ml-auto text-accent tabular-nums">{pr.done}/{pr.total}</span>
                )}
              </div>
              <div className="font-medium leading-snug line-clamp-2">{p.title}</div>
              {pr.hasCheckboxes && (
                <div className="mt-2 h-1 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${pr.percent * 100}%` }} />
                </div>
              )}
              {snippet && (
                <div className="text-[11px] text-mutedfg mt-2 italic leading-snug line-clamp-3">{truncate(snippet, 240)}</div>
              )}
              <div className="text-[11px] text-mutedfg mt-2 truncate">{p.slug}</div>
              {p.linked_session_id && (
                <div className="text-[11px] text-accent mt-1">linked session</div>
              )}
            </Link>
          );
        })}
        {plans.length === 0 && (
          <div className="col-span-full text-sm text-mutedfg text-center py-8">No plans match "{q}".</div>
        )}
      </div>
    </div>
  );
}
