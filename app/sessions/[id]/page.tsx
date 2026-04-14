import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession, getSessionMessages, getPlan, sessionStopReasons, sessionFiles, sessionToolCounts, getAdjacentSessions } from "@/lib/queries";
import { fmtDate, truncate } from "@/lib/utils";
import { fmtTokens, fmtCost, costUSD } from "@/lib/pricing";
import { SessionReplay } from "@/components/SessionReplay";
import { SessionBursts } from "@/components/SessionBursts";
import { ResumeButton } from "@/components/ResumeButton";
import { SessionMetaPanel } from "@/components/SessionMetaPanel";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const showAll = sp.all === "1";
  const s = getSession(id) as any;
  if (!s) return notFound();
  const { prompts, turns: allTurns } = getSessionMessages(id);
  // Cap assistant turns in the initial render for big sessions
  const TURN_CAP = 200;
  const turnsTruncated = !showAll && allTurns.length > TURN_CAP;
  const turns = turnsTruncated ? (allTurns as any[]).slice(-TURN_CAP) : allTurns;
  const plan = s.slug ? (getPlan(s.slug) as any) : null;
  // Aggregate tokens across ALL turns (not just the rendered window)
  const tIn = (allTurns as any[]).reduce((a: number, t: any) => a + (t.input_tokens || 0), 0);
  const tOut = (allTurns as any[]).reduce((a: number, t: any) => a + (t.output_tokens || 0), 0);
  const tCw = (allTurns as any[]).reduce((a: number, t: any) => a + (t.cache_creation_tokens || 0), 0);
  const tCr = (allTurns as any[]).reduce((a: number, t: any) => a + (t.cache_read_tokens || 0), 0);
  const model = ((allTurns as any[]).find((t: any) => t.model) as any)?.model || null;
  const cost = costUSD(model, tIn, tOut, tCw, tCr);
  const promptChars = (prompts as any[]).reduce((s: number, p: any) => s + (p.char_count || 0), 0);
  const verbosity = promptChars > 0 ? tOut / promptChars : 0;
  const stopReasons = sessionStopReasons(id);
  const files = sessionFiles(id);
  const tools = sessionToolCounts(id);
  const totalToolCalls = tools.reduce((sum, t) => sum + t.n, 0);
  const { prev: prevSes, next: nextSes } = getAdjacentSessions(id);
  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Session {s.id.slice(0, 8)}…</h1>
          <div className="text-xs text-mutedfg space-x-3 mt-1">
            <span>{fmtDate(s.started_at)} → {fmtDate(s.ended_at)}</span>
            <span>{prompts.length} prompts · {allTurns.length} assistant turns</span>
            {s.version && <span>v{s.version}</span>}
            {s.permission_mode && <span>{s.permission_mode}</span>}
            {s.git_branch && <span>git: {s.git_branch}</span>}
            {model && <span>{model}</span>}
            <span>· {fmtTokens(tOut)} out / {fmtTokens(tCr)} cached / {fmtCost(cost)}</span>
            {verbosity > 0 && <span title="output tokens per prompt char">· verbosity {verbosity.toFixed(1)}</span>}
          </div>
          {stopReasons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {stopReasons.map(sr => {
                const tone = sr.stop_reason === "end_turn" ? "text-emerald-300 border-emerald-500/40"
                           : sr.stop_reason === "tool_use" ? "text-cyan-300 border-cyan-500/40"
                           : sr.stop_reason === "max_tokens" ? "text-amber-300 border-amber-500/40"
                           : "text-mutedfg border-border";
                return (
                  <span key={sr.stop_reason}
                    className={`text-[10px] rounded border px-1.5 py-0.5 ${tone}`}
                    title="stop_reason from assistant turn">
                    {sr.stop_reason} <span className="opacity-70 tabular-nums">×{sr.n}</span>
                  </span>
                );
              })}
            </div>
          )}
          <div className="text-xs text-mutedfg mt-1">cwd: {s.cwd || "?"}</div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <SessionMetaPanel sessionId={s.id} />
          <ResumeButton sessionId={s.id} cwd={s.cwd || null} />
          {plan && <Link className="text-sm bg-accent/20 text-accent px-3 py-1.5 rounded hover:bg-accent/30"
                        href={`/plans/${encodeURIComponent(plan.slug)}`}>plan: {truncate(plan.title, 40)} →</Link>}
          <Link href="/prompts" className="text-sm px-3 py-1.5 rounded border border-border hover:bg-muted/60">← prompts</Link>
        </div>
      </header>

      {(prevSes || nextSes) && (
        <nav className="flex items-center justify-between gap-2 text-xs">
          <div className="flex-1 min-w-0">
            {prevSes ? (
              <Link href={`/sessions/${prevSes.id}`}
                    className="block rounded border border-border hover:border-accent/50 hover:bg-muted/40 px-3 py-2 transition">
                <div className="text-mutedfg">← previous in this project</div>
                <div className="text-fg truncate">
                  <span className="text-accent">{prevSes.slug || prevSes.id.slice(0, 8)}</span>
                  <span className="ml-2 text-mutedfg tabular-nums">{fmtDate(prevSes.started_at).slice(0, 16)} · {prevSes.turn_count}t</span>
                </div>
              </Link>
            ) : <div />}
          </div>
          <div className="flex-1 min-w-0">
            {nextSes ? (
              <Link href={`/sessions/${nextSes.id}`}
                    className="block rounded border border-border hover:border-accent/50 hover:bg-muted/40 px-3 py-2 transition text-right">
                <div className="text-mutedfg">next in this project →</div>
                <div className="text-fg truncate">
                  <span className="text-accent">{nextSes.slug || nextSes.id.slice(0, 8)}</span>
                  <span className="ml-2 text-mutedfg tabular-nums">{fmtDate(nextSes.started_at).slice(0, 16)} · {nextSes.turn_count}t</span>
                </div>
              </Link>
            ) : <div />}
          </div>
        </nav>
      )}

      <SessionBursts
        promptTimestamps={(prompts as any[]).map(p => p.ts).filter(Boolean)}
        sessionStart={s.started_at || 0}
        sessionEnd={s.ended_at || 0} />

      {(files.length > 0 || tools.length > 0) && (
        <section className="grid lg:grid-cols-2 gap-3">
          {files.length > 0 && (
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-sm font-medium">Files touched ({files.length})</h2>
                <Link href={`/files?project=${encodeURIComponent(s.project_id || "")}`} className="text-[11px] text-accent hover:underline">project files →</Link>
              </div>
              <ul className="space-y-0.5 max-h-64 overflow-y-auto">
                {files.slice(0, 30).map(f => (
                  <li key={f.file_path}>
                    <Link href={`/file?p=${encodeURIComponent(f.file_path)}`}
                          className="grid grid-cols-[1fr_50px_50px] items-center gap-2 text-[12px] hover:bg-muted/40 hover:text-accent rounded px-1.5 py-0.5">
                      <code className="font-mono truncate" title={f.file_path}>{f.file_path}</code>
                      <span className="text-right tabular-nums text-mutedfg" title="edits">{f.edits || ""}</span>
                      <span className="text-right tabular-nums text-mutedfg" title="reads">{f.reads || ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-[1fr_50px_50px] gap-2 text-[10px] text-mutedfg mt-1 px-1.5">
                <span>file</span>
                <span className="text-right">edits</span>
                <span className="text-right">reads</span>
              </div>
            </div>
          )}
          {tools.length > 0 && (
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <h2 className="text-sm font-medium mb-2">Tools used ({totalToolCalls.toLocaleString()} calls)</h2>
              <ul className="space-y-0.5 max-h-64 overflow-y-auto">
                {tools.map(t => {
                  const pct = totalToolCalls ? (t.n / totalToolCalls) * 100 : 0;
                  return (
                    <li key={t.name} className="grid grid-cols-[1fr_60px] items-center gap-2 text-[12px] hover:bg-muted/40 rounded px-1.5 py-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{t.name}</span>
                      </div>
                      <span className="text-right tabular-nums text-mutedfg">{t.n} · {pct.toFixed(0)}%</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {turnsTruncated && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs flex items-center justify-between">
          <span className="text-amber-200">
            Showing the most recent {TURN_CAP} of {allTurns.length} assistant turns.
            Older turns are hidden to keep the page fast.
          </span>
          <Link href={`?all=1`} className="text-amber-300 hover:underline">show all →</Link>
        </div>
      )}
      <SessionReplay prompts={prompts as any[]} turns={turns as any[]} />
    </div>
  );
}
