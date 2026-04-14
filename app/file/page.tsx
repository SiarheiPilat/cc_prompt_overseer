import Link from "next/link";
import { fileDetail, promptsMentioningFile } from "@/lib/queries";
import { fmtDate, fmtRelative, basename, truncate } from "@/lib/utils";
import { fmtDuration } from "@/lib/bursts";
import { Sparkline } from "@/components/Sparkline";
import { FileActions } from "@/components/FileActions";

export const dynamic = "force-dynamic";

export default async function FileDetailPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const path = sp.p || "";
  if (!path) {
    return (
      <div className="p-6 max-w-4xl">
        <h1 className="text-2xl font-semibold">File</h1>
        <p className="text-sm text-mutedfg mt-2">Pass <code>?p=&lt;file path&gt;</code>. Use the file rows on <Link className="text-accent hover:underline" href="/files">/files</Link>.</p>
      </div>
    );
  }
  const d = fileDetail(path);
  const mentions = promptsMentioningFile(path, 25);
  if (!d.totals || d.totals.total === 0) {
    return (
      <div className="p-6 max-w-4xl">
        <h1 className="text-2xl font-semibold break-all">{basename(path)}</h1>
        <p className="text-xs text-mutedfg mt-1 break-all">{path}</p>
        <p className="text-sm text-mutedfg mt-3">No tool calls touched this file.</p>
      </div>
    );
  }

  // Fill the sparkline across the file's calendar span
  const start = Date.parse(d.days[0].d + "T00:00:00Z");
  const end = Date.parse(d.days[d.days.length - 1].d + "T00:00:00Z");
  const span = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const map = new Map(d.days.map(x => [x.d, x.n]));
  const filled: number[] = [];
  for (let i = 0; i < span; i++) {
    const ds = new Date(start + i * 86400000).toISOString().slice(0, 10);
    filled.push(map.get(ds) || 0);
  }
  const ageMs = Date.now() - d.totals.last_ts;
  const status = ageMs < 7 * 86400000 ? "active" : ageMs < 30 * 86400000 ? "recent" : ageMs < 90 * 86400000 ? "cooling" : "dormant";

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs text-mutedfg">file</div>
          <h1 className="text-xl font-semibold break-all">{basename(path)}</h1>
          <p className="text-[11px] text-mutedfg break-all mt-0.5">{path}</p>
        </div>
        <FileActions path={path} />
      </header>

      <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Stat label="Total" value={(d.totals.total || 0).toLocaleString()} />
        <Stat label="Edits" value={(d.totals.edits || 0).toLocaleString()} />
        <Stat label="Reads" value={(d.totals.reads || 0).toLocaleString()} />
        <Stat label="Sessions" value={(d.totals.session_count || 0).toLocaleString()} />
        <Stat label="Span" value={`${span}d`} />
        <Stat label="Status" value={status} />
      </section>

      <section className="rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm font-medium">Activity over time</h2>
          <span className="text-[11px] text-mutedfg">first {fmtDate(d.totals.first_ts)} · last {fmtRelative(d.totals.last_ts)}</span>
        </div>
        <Sparkline values={filled} height={60} />
      </section>

      {mentions.length > 0 && (
        <section className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Prompts mentioning <code className="text-accent">{basename(path)}</code> ({mentions.length})</h2>
          <ul className="space-y-1">
            {mentions.map((m: any) => (
              <li key={m.id}>
                <Link href={`/sessions/${m.session_id}#p${m.id}`}
                  className="block rounded p-2 hover:bg-muted/40 border border-transparent hover:border-border">
                  <div className="text-[11px] text-mutedfg flex gap-2">
                    <span className="tabular-nums">{fmtDate(m.ts)}</span>
                    <span className="truncate">· {basename(m.cwd || "")}</span>
                  </div>
                  <div className="text-[12px] font-mono mt-0.5 line-clamp-2">{truncate((m.snippet || "").replace(/\s+/g, " "), 280)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">Sessions that touched this file</h2>
        <ul className="space-y-1 text-sm">
          {d.sessions.map((s: any) => (
            <li key={s.session_id}>
              <Link className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/60" href={`/sessions/${s.session_id}`}>
                <span className="text-[11px] text-mutedfg tabular-nums w-28">{fmtDate(s.first_ts)}</span>
                <span className="text-accent truncate flex-1 min-w-0">{s.slug || s.session_id.slice(0, 8)}</span>
                <span className="text-[11px] text-mutedfg truncate max-w-[200px]">{basename(s.cwd || "")}</span>
                <span className="text-xs text-mutedfg tabular-nums w-12 text-right" title="edits">{s.edits || 0}e</span>
                <span className="text-xs text-mutedfg tabular-nums w-12 text-right" title="reads">{s.reads || 0}r</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="text-[10px] uppercase tracking-wide text-mutedfg">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
