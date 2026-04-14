import Link from "next/link";
import { tokenSummary } from "@/lib/queries";
import { costUSD, fmtCost, fmtTokens } from "@/lib/pricing";
import { TokenWeekly } from "@/components/TokenWeekly";
import { basename } from "@/lib/utils";

export const dynamic = "force-dynamic";

function parseRange(sp: Record<string, string | undefined>): { from?: number; to?: number; label: string } {
  const preset = sp.preset || "";
  const now = Date.now();
  if (preset === "7d") return { from: now - 7 * 86400000, to: now, label: "last 7 days" };
  if (preset === "30d") return { from: now - 30 * 86400000, to: now, label: "last 30 days" };
  if (preset === "this-month") {
    const d = new Date();
    const from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    return { from, to: now, label: "this month" };
  }
  if (preset === "last-month") {
    const d = new Date();
    const from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
    const to = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    return { from, to, label: "last month" };
  }
  const fromStr = sp.from || "";
  const toStr = sp.to || "";
  const from = fromStr && /^\d{4}-\d{2}-\d{2}$/.test(fromStr) ? Date.parse(fromStr + "T00:00:00Z") : undefined;
  const to = toStr && /^\d{4}-\d{2}-\d{2}$/.test(toStr) ? Date.parse(toStr + "T23:59:59Z") : undefined;
  if (from || to) return { from, to, label: `${fromStr || "…"} → ${toStr || "now"}` };
  return { label: "all time" };
}

export default async function TokensPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const range = parseRange(sp);
  const t = tokenSummary({ from: range.from, to: range.to });
  const totalTokens = (t.totals.input || 0) + (t.totals.output || 0) + (t.totals.cache_creation || 0) + (t.totals.cache_read || 0);
  const totalCost = t.byModel.reduce((s, m) =>
    s + costUSD(m.model, m.input || 0, m.output || 0, m.cache_creation || 0, m.cache_read || 0), 0);
  const cacheHitRate = (t.totals.cache_read || 0) / Math.max(1, (t.totals.cache_read || 0) + (t.totals.cache_creation || 0));

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold">Tokens & Cost <span className="text-mutedfg text-base">· {range.label}</span></h1>
          <p className="text-sm text-mutedfg">Estimated using public Anthropic list prices. Treat as upper-bound for relative comparison.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center text-xs">
          {[
            ["", "all time"],
            ["7d", "7d"],
            ["30d", "30d"],
            ["this-month", "this month"],
            ["last-month", "last month"],
          ].map(([preset, label]) => (
            <Link key={preset || "all"}
              href={preset ? `/tokens?preset=${preset}` : "/tokens"}
              className={`rounded border px-2 py-1 ${
                (sp.preset || "") === preset && !(sp.from || sp.to)
                  ? "bg-accent/20 text-accent border-accent/50"
                  : "border-border hover:bg-muted/60"
              }`}>
              {label}
            </Link>
          ))}
          <form action="/tokens" className="flex items-center gap-1 ml-2 border-l border-border pl-3">
            <input type="date" name="from" defaultValue={sp.from || ""}
                   className="bg-muted rounded px-1.5 py-0.5 text-xs" />
            <span className="text-mutedfg">→</span>
            <input type="date" name="to" defaultValue={sp.to || ""}
                   className="bg-muted rounded px-1.5 py-0.5 text-xs" />
            <button className="bg-accent text-accentfg rounded px-2 py-0.5 text-xs">apply</button>
          </form>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card label="Total tokens" value={fmtTokens(totalTokens)} />
        <Card label="Output tokens" value={fmtTokens(t.totals.output || 0)} />
        <Card label="Cache hit rate" value={`${(cacheHitRate * 100).toFixed(1)}%`} sub="cache_read / (cache_read + cache_write)" />
        <Card label="Estimated cost" value={fmtCost(totalCost)} />
        <Card label="Assistant turns" value={(t.totals.turns || 0).toLocaleString()} />
      </section>

      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">Tokens per week (stacked)</h2>
        <TokenWeekly data={t.weekly} />
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">By model</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-mutedfg">
              <tr><th className="text-left">model</th><th className="text-right">turns</th><th className="text-right">in</th><th className="text-right">out</th><th className="text-right">cache rd</th><th className="text-right">cost</th></tr>
            </thead>
            <tbody>
              {t.byModel.map(m => (
                <tr key={m.model} className="border-t border-border/50">
                  <td className="py-1.5 truncate max-w-[180px]">{m.model}</td>
                  <td className="text-right tabular-nums">{m.turns.toLocaleString()}</td>
                  <td className="text-right tabular-nums">{fmtTokens(m.input)}</td>
                  <td className="text-right tabular-nums">{fmtTokens(m.output)}</td>
                  <td className="text-right tabular-nums">{fmtTokens(m.cache_read)}</td>
                  <td className="text-right tabular-nums">{fmtCost(costUSD(m.model, m.input, m.output, m.cache_creation, m.cache_read))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-border bg-card/60 p-4">
          <h2 className="text-sm font-medium mb-3">Top projects by spend</h2>
          <ol className="space-y-1 text-sm">
            {t.byProject.slice(0, 12).map((p, i) => {
              const cost = costUSD(null, p.input, p.output, p.cache_creation, p.cache_read);
              return (
                <li key={p.id}>
                  <Link className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/60" href={`/projects/${encodeURIComponent(p.id)}`}>
                    <span className="text-mutedfg w-5 text-[11px] tabular-nums">{i + 1}.</span>
                    <span className="flex-1 truncate">{basename(p.cwd || p.id)}</span>
                    <span className="text-mutedfg text-xs tabular-nums">{fmtTokens(p.output)} out</span>
                    <span className="text-fg text-xs tabular-nums w-16 text-right">{fmtCost(cost)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">Most expensive sessions</h2>
        <table className="w-full text-sm">
          <thead className="text-xs text-mutedfg">
            <tr><th className="text-left">session</th><th className="text-left">project</th><th className="text-right">turns</th><th className="text-right">output</th><th className="text-right">cache write</th><th className="text-right">cost</th></tr>
          </thead>
          <tbody>
            {t.bySession.map(s => {
              const cost = costUSD(s.model, s.input, s.output, s.cache_creation, s.cache_read);
              return (
                <tr key={s.id} className="border-t border-border/50">
                  <td className="py-1.5"><Link className="text-accent hover:underline" href={`/sessions/${s.id}`}>{s.slug || s.id.slice(0, 8)}</Link></td>
                  <td className="text-mutedfg truncate max-w-[200px]">{basename(s.cwd || "")}</td>
                  <td className="text-right tabular-nums">{s.turns}</td>
                  <td className="text-right tabular-nums">{fmtTokens(s.output)}</td>
                  <td className="text-right tabular-nums">{fmtTokens(s.cache_creation)}</td>
                  <td className="text-right tabular-nums">{fmtCost(cost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <div className="text-xs text-mutedfg">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-mutedfg mt-1">{sub}</div>}
    </div>
  );
}
