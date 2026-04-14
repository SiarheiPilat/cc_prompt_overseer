import Link from "next/link";
import { leaderboards } from "@/lib/ranking";

export const dynamic = "force-dynamic";

export default function RankingsPage() {
  const boards = leaderboards();
  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Rankings</h1>
        <p className="text-sm text-mutedfg">Leaderboards across every session you've ever run.</p>
      </header>
      <div className="grid lg:grid-cols-2 gap-4">
        {boards.map(b => (
          <div key={b.title} className="rounded-lg border border-border bg-card/60 p-4">
            <h2 className="text-sm font-medium mb-3">{b.title}</h2>
            <ol className="space-y-1 text-sm">
              {b.rows.length === 0 && <li className="text-mutedfg text-xs">(no data)</li>}
              {b.rows.map((r, i) => {
                const content = (
                  <>
                    <span className="text-mutedfg w-6 text-[11px] tabular-nums">{i + 1}.</span>
                    <span className="truncate flex-1 min-w-0">{r.label}</span>
                    {r.sub && <span className="text-[11px] text-mutedfg truncate max-w-[160px]">{r.sub}</span>}
                    <span className="text-mutedfg text-xs tabular-nums">{r.value}</span>
                  </>
                );
                return (
                  <li key={i}>
                    {r.href ? (
                      <Link className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/60" href={r.href}>{content}</Link>
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-1">{content}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
