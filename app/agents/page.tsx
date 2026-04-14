import Link from "next/link";
import { agentInvocations, agentSubtypeCounts, getProjects } from "@/lib/queries";
import { fmtDate, fmtRelative, truncate, basename } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AgentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const project = sp.project || "";
  const subagent = sp.sub || "";
  const projects = getProjects() as any[];
  const subs = agentSubtypeCounts(project || undefined);
  const recents = agentInvocations({ project: project || undefined, subagent: subagent || undefined, limit: 100 });
  const total = subs.reduce((s, x) => s + x.n, 0);
  const maxN = Math.max(1, ...subs.map(s => s.n));

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Agents</h1>
          <p className="text-sm text-mutedfg">
            {total.toLocaleString()} subagent invocations
            {project ? " in this project." : "."}
            {subagent && <> · subagent: <span className="text-accent">{subagent}</span></>}
          </p>
        </div>
        <form className="flex gap-2 items-center text-sm" action="/agents">
          <select name="project" defaultValue={project}
                  className="bg-muted rounded px-2 py-1.5 text-sm min-w-[260px]">
            <option value="">all projects</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.cwd || p.id}</option>)}
          </select>
          <input name="sub" defaultValue={subagent} placeholder="subagent type"
                 className="bg-muted rounded px-2 py-1.5 text-sm w-44" />
          <button className="bg-accent text-accentfg rounded px-3 py-1.5 text-sm hover:opacity-90">filter</button>
        </form>
      </header>

      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">Subagent types</h2>
        <ul className="space-y-1 text-sm">
          {subs.map(s => {
            const pct = (s.n / maxN) * 100;
            return (
              <li key={s.subagent}>
                <Link href={`/agents?sub=${encodeURIComponent(s.subagent)}${project ? `&project=${encodeURIComponent(project)}` : ""}`}
                  className={`block rounded p-2 hover:bg-muted/60 ${subagent === s.subagent ? "bg-muted/60 ring-1 ring-accent/50" : ""}`}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-accent flex-1 truncate min-w-0">{s.subagent}</span>
                    <span className="text-mutedfg text-xs tabular-nums">{s.n}</span>
                    <span className="text-mutedfg text-[11px] tabular-nums w-24 text-right">{fmtRelative(s.last)}</span>
                  </div>
                  <div className="h-1 mt-1 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-accent/60" style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              </li>
            );
          })}
          {subs.length === 0 && <li className="text-mutedfg text-xs">no agent invocations match</li>}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">Recent invocations ({recents.length})</h2>
        <ul className="space-y-1.5">
          {recents.map(r => (
            <li key={r.id}>
              <Link href={`/sessions/${r.session_id}`}
                className="block rounded p-2 hover:bg-muted/60 border border-transparent hover:border-border">
                <div className="text-[11px] text-mutedfg flex gap-2 items-baseline">
                  <span className="tabular-nums">{fmtDate(r.ts)}</span>
                  {r.subagent && <span className="text-accent">{r.subagent}</span>}
                  {r.description && <span className="truncate">· {r.description}</span>}
                </div>
                {r.prompt && (
                  <div className="text-[12px] font-mono mt-0.5 line-clamp-2 text-fg">
                    {truncate(r.prompt.replace(/\s+/g, " "), 280)}
                  </div>
                )}
              </Link>
            </li>
          ))}
          {recents.length === 0 && <li className="text-mutedfg text-xs">no invocations</li>}
        </ul>
      </section>
    </div>
  );
}
