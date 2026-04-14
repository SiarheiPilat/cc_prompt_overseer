import Link from "next/link";
import { bashCommands, bashLeadingWords, getProjects } from "@/lib/queries";
import { fmtRelative } from "@/lib/utils";
import { CommandCopyButton } from "@/components/CommandCopyButton";

export const dynamic = "force-dynamic";

export default async function CommandsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const project = sp.project || "";
  const prefix = sp.prefix || "";
  const limit = Math.min(1000, Math.max(10, Number(sp.limit) || 60));
  const cmds = bashCommands({ project: project || undefined, prefix: prefix || undefined, limit });
  const lead = bashLeadingWords(project || undefined);
  const projects = getProjects() as any[];
  const totalRuns = cmds.reduce((s: number, c: any) => s + (c.n || 0), 0);

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Commands</h1>
          <p className="text-sm text-mutedfg">
            Bash commands Claude has run for you{prefix && <> · prefix <span className="text-accent">{prefix}</span></>}
            {project ? " in this project." : "."}
            {" "}{cmds.length.toLocaleString()} unique · {totalRuns.toLocaleString()} runs.
          </p>
        </div>
        <form className="flex gap-2 items-center text-sm" action="/commands">
          <select name="project" defaultValue={project}
                  className="bg-muted rounded px-2 py-1.5 text-sm min-w-[220px]">
            <option value="">all projects</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.cwd || p.id}</option>)}
          </select>
          <input name="prefix" defaultValue={prefix} placeholder="prefix (e.g. git)"
                 className="bg-muted rounded px-2 py-1.5 text-sm w-40" />
          <select name="limit" defaultValue={String(limit)}
                  className="bg-muted rounded px-2 py-1.5 text-sm">
            {[30, 60, 100, 200, 500].map(n => <option key={n} value={n}>{n} rows</option>)}
          </select>
          <button className="bg-accent text-accentfg rounded px-3 py-1.5 text-sm hover:opacity-90">filter</button>
        </form>
      </header>

      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">Top leading words</h2>
        <div className="flex flex-wrap gap-1.5">
          {lead.map(l => (
            <Link key={l.w}
              href={`/commands?prefix=${encodeURIComponent(l.w + " ")}${project ? `&project=${encodeURIComponent(project)}` : ""}`}
              className="text-[11px] rounded border border-border px-2 py-0.5 hover:bg-muted/60 hover:text-accent">
              <span className="text-accent">{l.w}</span> <span className="text-mutedfg tabular-nums">{l.n}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card/60">
        <table className="w-full text-sm">
          <thead className="text-xs text-mutedfg sticky top-0 bg-card/80 backdrop-blur">
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 w-12">#</th>
              <th className="text-left px-3 py-2">command</th>
              <th className="text-right px-3 py-2 w-16">runs</th>
              <th className="text-right px-3 py-2 w-20">sessions</th>
              <th className="text-right px-3 py-2 w-24">last</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {cmds.map((c: any, i: number) => (
              <tr key={i} className="border-b border-border/60 hover:bg-muted/40">
                <td className="px-3 py-1.5 text-mutedfg tabular-nums">{i + 1}</td>
                <td className="px-3 py-1.5 max-w-0">
                  <code className="font-mono text-[12px] block whitespace-pre-wrap break-all line-clamp-2" title={c.command}>{c.command}</code>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{c.n}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-mutedfg">{c.sessions}</td>
                <td className="px-3 py-1.5 text-right text-[11px] text-mutedfg whitespace-nowrap">{fmtRelative(c.last_ts)}</td>
                <td className="px-3 py-1.5 text-right"><CommandCopyButton text={c.command} /></td>
              </tr>
            ))}
            {cmds.length === 0 && (
              <tr><td colSpan={6} className="text-center text-mutedfg text-sm py-6">no commands match</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
