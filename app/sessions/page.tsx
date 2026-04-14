import Link from "next/link";
import { getAllSessions, getProjects } from "@/lib/queries";
import { fmtDate, fmtRelative, basename } from "@/lib/utils";
import { fmtCost, fmtTokens, costUSD } from "@/lib/pricing";
import { Star } from "lucide-react";
import { SessionStarButton } from "@/components/SessionStarButton";

export const dynamic = "force-dynamic";

export default async function SessionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sort = (sp.sort as any) || "started";
  const limit = Math.min(1000, Math.max(20, Number(sp.limit) || 200));
  const hasPlan = sp.hasPlan === "1";
  const marathon = sp.marathon === "1";
  const starred = sp.starred === "1";
  const days = Number(sp.days) || 0;
  const perm = sp.perm || "";
  const tag = sp.tag || "";
  const q = sp.q || "";
  const project = sp.project || "";
  const now = Date.now();
  const from = days > 0 ? now - days * 86400000 : undefined;

  const sessions = getAllSessions({
    sort, limit, hasPlan, marathon, starred, from,
    perm: perm || undefined,
    tag: tag || undefined,
    q: q || undefined,
    project: project || undefined,
  });
  const projects = getProjects() as any[];
  const totalCost = sessions.reduce((sum, s) =>
    sum + costUSD(s.model, s.in_tok || 0, s.out_tok || 0, s.cw_tok || 0, s.cr_tok || 0), 0);

  // Helper to build a URL preserving current params + toggling/setting one
  function url(overrides: Record<string, string | null>): string {
    const p = new URLSearchParams();
    if (sort !== "started") p.set("sort", sort);
    if (limit !== 200) p.set("limit", String(limit));
    if (hasPlan) p.set("hasPlan", "1");
    if (marathon) p.set("marathon", "1");
    if (starred) p.set("starred", "1");
    if (days) p.set("days", String(days));
    if (perm) p.set("perm", perm);
    if (tag) p.set("tag", tag);
    if (q) p.set("q", q);
    if (project) p.set("project", project);
    for (const [k, v] of Object.entries(overrides)) {
      if (v == null || v === "") p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return s ? `/sessions?${s}` : "/sessions";
  }
  const chip = (active: boolean, label: string, href: string) => (
    <Link href={href} className={`text-[11px] rounded border px-2 py-0.5 ${active
      ? "border-accent/60 bg-accent/15 text-accent"
      : "border-border hover:bg-muted/60 hover:text-accent"}`}>{label}</Link>
  );
  const sortLink = (key: string, label: string) =>
    sort === key
      ? <span className="text-accent font-medium">{label}</span>
      : <Link href={url({ sort: key === "started" ? null : key })} className="hover:text-accent">{label}</Link>;

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sessions</h1>
          <p className="text-sm text-mutedfg">
            {sessions.length} sessions{limit < 1000 && " · limit applied"} · {fmtCost(totalCost)} estimated total
            {q && <> · matching <span className="text-accent">"{q}"</span></>}
            {tag && <> · tag <span className="text-accent">{tag}</span></>}
            {project && <> · project <span className="text-accent">{basename(projects.find((p: any) => p.id === project)?.cwd || project)}</span></>}
          </p>
        </div>
        <div className="flex gap-3 text-xs items-center flex-wrap">
          <form action="/sessions" className="flex gap-1 items-center">
            {/* preserve other filters when submitting search */}
            {hasPlan && <input type="hidden" name="hasPlan" value="1" />}
            {marathon && <input type="hidden" name="marathon" value="1" />}
            {starred && <input type="hidden" name="starred" value="1" />}
            {days > 0 && <input type="hidden" name="days" value={String(days)} />}
            {perm && <input type="hidden" name="perm" value={perm} />}
            {tag && <input type="hidden" name="tag" value={tag} />}
            {sort !== "started" && <input type="hidden" name="sort" value={sort} />}
            {limit !== 200 && <input type="hidden" name="limit" value={String(limit)} />}
            <select name="project" defaultValue={project}
                    className="bg-muted rounded px-2 py-1 text-xs max-w-[180px]">
              <option value="">all projects</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{basename(p.cwd || p.id)}</option>)}
            </select>
            <input name="q" defaultValue={q} placeholder="slug, cwd, note…"
                   className="bg-muted rounded px-2 py-1 text-xs w-40 outline-none border border-transparent focus:border-accent/60" />
            <button className="bg-accent text-accentfg rounded px-2 py-1 text-xs hover:opacity-90">go</button>
          </form>
          <span className="text-mutedfg">sort:</span>
          {sortLink("started", "newest")}
          {sortLink("prompts", "most prompts")}
          {sortLink("cost", "highest cost")}
          <span className="text-mutedfg ml-3">limit:</span>
          {[100, 200, 500, 1000].map(n => (
            <Link key={n} href={url({ limit: n === 200 ? null : String(n) })}
              className={`hover:text-accent ${limit === n ? "text-accent font-medium" : ""}`}>{n}</Link>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-mutedfg">filter:</span>
        {chip(hasPlan,  "with plan",  url({ hasPlan: hasPlan ? null : "1" }))}
        {chip(marathon, "marathon (>4h)", url({ marathon: marathon ? null : "1" }))}
        {chip(starred,  "★ starred",  url({ starred: starred ? null : "1" }))}
        {chip(days === 1,  "today",  url({ days: days === 1  ? null : "1" }))}
        {chip(days === 7,  "7 days", url({ days: days === 7  ? null : "7" }))}
        {chip(days === 30, "30 days", url({ days: days === 30 ? null : "30" }))}
        <span className="text-mutedfg ml-2">perm:</span>
        {(["default","acceptEdits","bypassPermissions","plan"] as const).map(p =>
          <span key={p}>{chip(perm === p, p, url({ perm: perm === p ? null : p }))}</span>
        )}
        {(hasPlan || marathon || starred || days || perm || q || tag || project) && (
          <Link href="/sessions" className="text-[11px] text-mutedfg hover:text-fg ml-2 underline">clear filters</Link>
        )}
      </div>

      <section className="rounded-lg border border-border bg-card/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-mutedfg sticky top-0 bg-card/80 backdrop-blur">
            <tr className="border-b border-border">
              <th className="px-2 py-2 w-8"></th>
              <th className="text-left px-3 py-2 w-32">started</th>
              <th className="text-left px-3 py-2">slug</th>
              <th className="text-left px-3 py-2">project</th>
              <th className="text-right px-3 py-2 w-20">prompts</th>
              <th className="text-right px-3 py-2 w-20">turns</th>
              <th className="text-right px-3 py-2 w-20">output</th>
              <th className="text-right px-3 py-2 w-20">cost</th>
              <th className="text-left px-3 py-2 w-28">perm</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s: any) => (
              <tr key={s.id} className="border-b border-border/60 hover:bg-muted/40">
                <td className="px-2 py-1.5 text-center"><SessionStarButton sessionId={s.id} initial={!!s.starred} /></td>
                <td className="px-3 py-1.5 text-xs text-mutedfg tabular-nums whitespace-nowrap">{fmtDate(s.started_at).slice(0, 16)}</td>
                <td className="px-3 py-1.5 max-w-0">
                  <Link className="text-accent hover:underline truncate flex items-center gap-1.5"
                        href={`/sessions/${s.id}`} title={s.note || undefined}>
                    <span className="truncate">{s.slug || s.id.slice(0, 8)}</span>
                    {s.plan_slug && <span className="text-[10px] bg-accent/20 text-accent rounded px-1.5 py-0.5 shrink-0">plan</span>}
                    {s.note && <span className="text-[10px] text-mutedfg italic truncate">· {s.note.slice(0, 60)}</span>}
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-xs text-mutedfg max-w-0">
                  <div className="truncate">{basename(s.cwd || "")}</div>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{s.prompt_count || 0}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-mutedfg">{s.turn_count || 0}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-mutedfg">{s.out_tok ? fmtTokens(s.out_tok) : ""}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {fmtCost(costUSD(s.model, s.in_tok || 0, s.out_tok || 0, s.cw_tok || 0, s.cr_tok || 0))}
                </td>
                <td className="px-3 py-1.5 text-xs text-mutedfg whitespace-nowrap">{s.permission_mode || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
