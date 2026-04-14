import Link from "next/link";
import { fileUsage, fileExtCounts, getProjects } from "@/lib/queries";
import { fmtRelative, basename } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FilesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const project = sp.project || "";
  const files = fileUsage({ project: project || undefined, limit: 200 });
  const exts = fileExtCounts();
  const projects = getProjects() as any[];
  const totalEdits = files.reduce((s: number, f: any) => s + (f.edits || 0), 0);
  const totalReads = files.reduce((s: number, f: any) => s + (f.reads || 0), 0);

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Files</h1>
          <p className="text-sm text-mutedfg">
            Most-touched files across {project ? "this project" : "every session"}.
            {!project && ` ${totalEdits.toLocaleString()} edits · ${totalReads.toLocaleString()} reads in top ${files.length}.`}
          </p>
        </div>
        <form className="flex gap-2 items-center text-sm" action="/files">
          <select name="project" defaultValue={project}
                  className="bg-muted rounded px-2 py-1.5 text-sm min-w-[260px]">
            <option value="">all projects</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.cwd || p.id}</option>)}
          </select>
          <button className="bg-accent text-accentfg rounded px-3 py-1.5 text-sm hover:opacity-90">filter</button>
        </form>
      </header>

      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">Extensions</h2>
        <div className="flex flex-wrap gap-1.5">
          {exts.map(e => (
            <span key={e.ext} className="text-[11px] rounded border border-border px-2 py-0.5">
              <span className="text-accent">.{e.ext}</span> <span className="text-mutedfg tabular-nums">{e.n}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card/60">
        <table className="w-full text-sm">
          <thead className="text-xs text-mutedfg sticky top-0 bg-card/80 backdrop-blur">
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 w-12">#</th>
              <th className="text-left px-3 py-2">file</th>
              <th className="text-right px-3 py-2 w-16">edits</th>
              <th className="text-right px-3 py-2 w-16">reads</th>
              <th className="text-right px-3 py-2 w-16">total</th>
              <th className="text-right px-3 py-2 w-16">sessions</th>
              <th className="text-right px-3 py-2 w-24">last</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f: any, i: number) => (
              <tr key={f.file_path} className="border-b border-border/60 hover:bg-muted/40">
                <td className="px-3 py-1.5 text-mutedfg tabular-nums">{i + 1}</td>
                <td className="px-3 py-1.5 max-w-0">
                  <Link href={`/file?p=${encodeURIComponent(f.file_path)}`}
                        className="block hover:text-accent">
                    <div className="font-mono text-[12px] truncate" title={f.file_path}>{f.file_path}</div>
                    <div className="text-[10px] text-mutedfg truncate">{basename(f.file_path)}</div>
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{f.edits || ""}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-mutedfg">{f.reads || ""}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{f.total}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-mutedfg">{f.sessions}</td>
                <td className="px-3 py-1.5 text-right text-[11px] text-mutedfg whitespace-nowrap">{fmtRelative(f.last_ts)}</td>
              </tr>
            ))}
            {files.length === 0 && (
              <tr><td colSpan={7} className="text-center text-mutedfg text-sm py-6">no file activity for this filter</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
