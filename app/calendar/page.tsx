import Link from "next/link";
import { db } from "@/lib/db";
import { CalendarGrid } from "@/components/CalendarGrid";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.y) || now.getUTCFullYear();
  const month = Number(sp.m) || (now.getUTCMonth() + 1);
  const days = db().prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d, COUNT(*) AS n
    FROM prompts WHERE ts >= ? AND ts < ? GROUP BY d
  `).all(
    Date.UTC(year, month - 1, 1),
    Date.UTC(year, month, 1)
  ) as Array<{ d: string; n: number }>;

  const yearDays = db().prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS d, COUNT(*) AS n
    FROM prompts WHERE ts >= ? AND ts < ? GROUP BY d
  `).all(
    Date.UTC(year, 0, 1),
    Date.UTC(year + 1, 0, 1)
  ) as Array<{ d: string; n: number }>;

  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-mutedfg">Click any day to see that day's prompts.</p>
        </div>
        <div className="flex gap-2 items-center text-sm">
          <Link className="px-2 py-1 rounded border border-border hover:bg-muted/60" href={`/calendar?y=${prevMonth.y}&m=${prevMonth.m}`}>←</Link>
          <span className="font-medium tabular-nums w-44 text-center">{monthName}</span>
          <Link className="px-2 py-1 rounded border border-border hover:bg-muted/60" href={`/calendar?y=${nextMonth.y}&m=${nextMonth.m}`}>→</Link>
        </div>
      </header>
      <CalendarGrid year={year} month={month} data={days} />
      <section className="rounded-lg border border-border bg-card/60 p-4">
        <h2 className="text-sm font-medium mb-3">{year} year-at-a-glance</h2>
        <YearCalendar year={year} data={yearDays} />
      </section>
    </div>
  );
}

function YearCalendar({ year, data }: { year: number; data: Array<{ d: string; n: number }> }) {
  const map = new Map(data.map(d => [d.d, d.n]));
  const max = Math.max(1, ...data.map(d => d.n));
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const days: Array<{ d: string; n: number }> = [];
  for (let t = start.getTime(); t < end.getTime(); t += 86400000) {
    const d = new Date(t).toISOString().slice(0, 10);
    days.push({ d, n: map.get(d) || 0 });
  }
  // Lay out as 53 columns × 7 rows
  const startDay = start.getUTCDay();
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid" style={{ gridTemplateRows: "repeat(7, 12px)", gridTemplateColumns: `repeat(53, 12px)`, gap: 2, gridAutoFlow: "column" }}>
        {Array.from({ length: startDay }).map((_, i) => <div key={`pad${i}`} />)}
        {days.map(d => {
          const intensity = d.n / max;
          const bg = d.n === 0 ? "hsl(var(--muted))" : `hsla(265, 85%, ${72 - intensity*45}%, ${0.3 + intensity*0.7})`;
          return (
            <Link key={d.d} href={`/prompts?from=${Date.parse(d.d + "T00:00:00Z")}&to=${Date.parse(d.d + "T23:59:59Z")}`}
              className="rounded-sm hover:ring-1 hover:ring-accent" style={{ background: bg, width: 12, height: 12 }}
              title={`${d.d} — ${d.n}`} />
          );
        })}
      </div>
    </div>
  );
}
