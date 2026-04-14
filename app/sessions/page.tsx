import Link from "next/link";
import { getAllSessions } from "@/lib/queries";
import { fmtDate, fmtRelative, basename } from "@/lib/utils";
import { fmtCost, fmtTokens, costUSD } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function SessionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sort = (sp.sort as any) || "started";
  const limit = Math.min(1000, Math.max(20, Number(sp.limit) || 200));
  const sessions = getAllSessions({ sort, limit });
  const totalCost = sessions.reduce((sum, s) =>
    sum + costUSD(s.model, s.in_tok || 0, s.out_tok || 0, s.cw_tok || 0, s.cr_tok || 0), 0);

  const sortLink = (key: string, label: string) =>
    sort === key
      ? <span className="text-accent font-medium">{label}</span>
      : <Link href={`/sessions?sort=${key}${limit !== 200 ? `&limit=${limit}` : ""}`} className="hover:text-accent">{label}</Link>;

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sessions</h1>
          <p className="text-sm text-mutedfg">
            All {sessions.length} sessions{limit < 1000 && " (limit applied)"} · {fmtCost(totalCost)} estimated total
          </p>
        </div>
        <div className="flex gap-3 text-xs items-center">
          <span className="text-mutedfg">sort:</span>
          {sortLink("started", "newest")}
          {sortLink("prompts", "most prompts")}
          {sortLink("cost", "highest cost")}
          <span className="text-mutedfg ml-3">limit:</span>
          {[100, 200, 500, 1000].map(n => (
            <Link key={n} href={`/sessions?sort=${sort}&limit=${n}`}
              className={`hover:text-accent ${limit === n ? "text-accent font-medium" : ""}`}>{n}</Link>
          ))}
        </div>
      </header>

      <section className="rounded-lg border border-border bg-card/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-mutedfg sticky top-0 bg-card/80 backdrop-blur">
            <tr className="border-b border-border">
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
                <td className="px-3 py-1.5 text-xs text-mutedfg tabular-nums whitespace-nowrap">{fmtDate(s.started_at).slice(0, 16)}</td>
                <td className="px-3 py-1.5 max-w-0">
                  <Link className="text-accent hover:underline truncate block" href={`/sessions/${s.id}`}>
                    {s.slug || s.id.slice(0, 8)}
                    {s.plan_slug && <span className="ml-2 text-[10px] bg-accent/20 text-accent rounded px-1.5 py-0.5">plan</span>}
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
