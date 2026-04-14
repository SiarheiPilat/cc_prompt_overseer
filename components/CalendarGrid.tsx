"use client";
import Link from "next/link";

export function CalendarGrid({
  year, month, data, mode = "prompts",
}: {
  year: number;
  month: number;
  data: Array<{ d: string; n: number }>;
  mode?: "prompts" | "cost";
}) {
  const map = new Map(data.map(d => [d.d, d.n]));
  const max = Math.max(1, ...data.map(d => d.n));
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const startDay = first.getUTCDay();
  const days: Array<{ d: string; n: number; day: number } | null> = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= last.getUTCDate(); i++) {
    const ds = new Date(Date.UTC(year, month - 1, i)).toISOString().slice(0, 10);
    days.push({ d: ds, n: map.get(ds) || 0, day: i });
  }
  const labels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const hue = mode === "cost" ? 35 : 265; // amber for cost, accent purple for prompts
  const fmt = (n: number) =>
    mode === "cost"
      ? n >= 100 ? `$${n.toFixed(0)}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(3)}`
      : n.toLocaleString();
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <div className="grid grid-cols-7 gap-2">
        {labels.map(l => <div key={l} className="text-[10px] text-mutedfg uppercase tracking-wide text-center">{l}</div>)}
        {days.map((d, i) => {
          if (!d) return <div key={`pad${i}`} className="aspect-square" />;
          const intensity = d.n / max;
          const bg = d.n === 0 ? "hsl(var(--muted))" : `hsla(${hue}, 85%, ${72 - intensity*45}%, ${0.3 + intensity*0.7})`;
          return (
            <Link key={d.d}
              href={`/prompts?from=${Date.parse(d.d + "T00:00:00Z")}&to=${Date.parse(d.d + "T23:59:59Z")}`}
              className="aspect-square rounded p-2 hover:ring-2 hover:ring-accent transition flex flex-col"
              style={{ background: bg }}
              title={`${d.d} — ${fmt(d.n)}`}>
              <div className="text-xs font-medium">{d.day}</div>
              <div className="mt-auto text-[10px] text-mutedfg tabular-nums">{d.n ? fmt(d.n) : ""}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
