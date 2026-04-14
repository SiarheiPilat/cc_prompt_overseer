import Link from "next/link";
import { db } from "@/lib/db";
import { CalendarGrid } from "@/components/CalendarGrid";
import { costUSD, fmtCost } from "@/lib/pricing";

export const dynamic = "force-dynamic";

type DayCost = { d: string; cost: number };

function dailyCostInRange(fromMs: number, toMs: number): DayCost[] {
  const rows = db().prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d,
      model,
      SUM(input_tokens) AS i, SUM(output_tokens) AS o,
      SUM(cache_creation_tokens) AS cw, SUM(cache_read_tokens) AS cr
    FROM assistant_turns
    WHERE ts >= ? AND ts < ? AND model IS NOT NULL
    GROUP BY d, model
  `).all(fromMs, toMs) as Array<{ d: string; model: string; i: number; o: number; cw: number; cr: number }>;
  // Sum cost per day across models
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const c = costUSD(r.model, r.i || 0, r.o || 0, r.cw || 0, r.cr || 0);
    byDay.set(r.d, (byDay.get(r.d) || 0) + c);
  }
  return Array.from(byDay.entries()).map(([d, cost]) => ({ d, cost }));
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.y) || now.getUTCFullYear();
  const month = Number(sp.m) || (now.getUTCMonth() + 1);
  const mode = sp.mode === "cost" ? "cost" : "prompts";

  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 1);
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year + 1, 0, 1);

  let days: Array<{ d: string; n: number }>;
  let yearDays: Array<{ d: string; n: number }>;
  if (mode === "cost") {
    days = dailyCostInRange(monthStart, monthEnd).map(r => ({ d: r.d, n: r.cost }));
    yearDays = dailyCostInRange(yearStart, yearEnd).map(r => ({ d: r.d, n: r.cost }));
  } else {
    days = db().prepare(`
      SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d, COUNT(*) AS n
      FROM prompts WHERE ts >= ? AND ts < ? GROUP BY d
    `).all(monthStart, monthEnd) as Array<{ d: string; n: number }>;
    yearDays = db().prepare(`
      SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d, COUNT(*) AS n
      FROM prompts WHERE ts >= ? AND ts < ? GROUP BY d
    `).all(yearStart, yearEnd) as Array<{ d: string; n: number }>;
  }

  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const monthTotal = days.reduce((s, d) => s + d.n, 0);
  const fmt = mode === "cost" ? (n: number) => fmtCost(n) : (n: number) => n.toLocaleString();

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-mutedfg">
            Showing {mode === "cost" ? "estimated cost" : "prompt count"} per day · {monthName}: {fmt(monthTotal)}
          </p>
        </div>
        <div className="flex gap-3 items-center text-sm">
          <div className="flex gap-1">
            <Link className={`text-xs rounded border px-2 py-1 ${mode === "prompts" ? "border-accent/60 bg-accent/15 text-accent" : "border-border hover:bg-muted/60"}`}
                  href={`/calendar?y=${year}&m=${month}`}>prompts</Link>
            <Link className={`text-xs rounded border px-2 py-1 ${mode === "cost" ? "border-accent/60 bg-accent/15 text-accent" : "border-border hover:bg-muted/60"}`}
                  href={`/calendar?y=${year}&m=${month}&mode=cost`}>cost</Link>
          </div>
          <Link className="px-2 py-1 rounded border border-border hover:bg-muted/60" href={`/calendar?y=${prevMonth.y}&m=${prevMonth.m}${mode === "cost" ? "&mode=cost" : ""}`}>←</Link>
          <span className="font-medium tabular-nums w-44 text-center">{monthName}</span>
          <Link className="px-2 py-1 rounded border border-border hover:bg-muted/60" href={`/calendar?y=${nextMonth.y}&m=${nextMonth.m}${mode === "cost" ? "&mode=cost" : ""}`}>→</Link>
        </div>
      </header>
      <CalendarGrid year={year} month={month} data={days} mode={mode} />
      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">{year} year-at-a-glance ({mode})</h2>
        <YearCalendar year={year} data={yearDays} mode={mode} />
      </section>
    </div>
  );
}

function YearCalendar({ year, data, mode }: { year: number; data: Array<{ d: string; n: number }>; mode: "prompts" | "cost" }) {
  const map = new Map(data.map(d => [d.d, d.n]));
  const max = Math.max(1, ...data.map(d => d.n));
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const days: Array<{ d: string; n: number }> = [];
  for (let t = start.getTime(); t < end.getTime(); t += 86400000) {
    const d = new Date(t).toISOString().slice(0, 10);
    days.push({ d, n: map.get(d) || 0 });
  }
  const startDay = start.getUTCDay();
  // Color hue: prompts = accent purple, cost = amber for visual distinction
  const hue = mode === "cost" ? 35 : 265;
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid" style={{ gridTemplateRows: "repeat(7, 12px)", gridTemplateColumns: `repeat(53, 12px)`, gap: 2, gridAutoFlow: "column" }}>
        {Array.from({ length: startDay }).map((_, i) => <div key={`pad${i}`} />)}
        {days.map(d => {
          const intensity = d.n / max;
          const bg = d.n === 0 ? "hsl(var(--muted))" : `hsla(${hue}, 85%, ${72 - intensity * 45}%, ${0.3 + intensity * 0.7})`;
          const tip = mode === "cost" ? `${d.d} — $${d.n.toFixed(2)}` : `${d.d} — ${d.n}`;
          return (
            <Link key={d.d} href={`/prompts?from=${Date.parse(d.d + "T00:00:00Z")}&to=${Date.parse(d.d + "T23:59:59Z")}`}
              className="rounded-sm hover:ring-1 hover:ring-accent" style={{ background: bg, width: 12, height: 12 }}
              title={tip} />
          );
        })}
      </div>
    </div>
  );
}
