import { toolUsage, categoryBreakdown } from "@/lib/queries";
import { SlashChart } from "@/components/SlashChart";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ToolsPage() {
  const tools = toolUsage();
  const cats = categoryBreakdown();
  const totalTools = tools.reduce((s, t) => s + t.n, 0);
  const totalCats = cats.reduce((s, c) => s + c.n, 0);
  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Tools & Categories</h1>
        <p className="text-sm text-mutedfg">What Claude reaches for, and what shape your prompts tend to take.</p>
      </header>
      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">Tool usage ({totalTools.toLocaleString()} total calls)</h2>
        <SlashChart data={tools.slice(0, 25).map(t => ({ slash_name: t.name, n: t.n }))} />
        <table className="w-full text-sm mt-4">
          <thead className="text-xs text-mutedfg"><tr><th className="text-left">tool</th><th className="text-right">calls</th><th className="text-right">%</th></tr></thead>
          <tbody>
            {tools.map(t => (
              <tr key={t.name} className="border-t border-border/50">
                <td className="py-1">{t.name}</td>
                <td className="text-right tabular-nums">{t.n.toLocaleString()}</td>
                <td className="text-right text-mutedfg tabular-nums">{(t.n / totalTools * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">Prompt categories ({totalCats.toLocaleString()} total)</h2>
        <ul className="grid md:grid-cols-2 gap-2 text-sm">
          {cats.map(c => (
            <li key={c.category}>
              <Link className="flex justify-between items-center px-3 py-2 rounded border border-border hover:bg-muted/60"
                href={`/prompts?cat=${encodeURIComponent(c.category)}`}>
                <span>{c.category}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-mutedfg tabular-nums">{((c.n/totalCats)*100).toFixed(1)}%</span>
                  <span className="tabular-nums">{c.n}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
