"use client";
import { useMemo, useState } from "react";

type Top = { session_id: string; slug: string | null; n: number };

export function Heatmap({
  data,
  topSessions,
}: {
  data: Array<{ dow: number; hour: number; n: number }>;
  topSessions?: Record<string, Top[]>;
}) {
  const { grid, max } = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    for (const r of data) {
      if (r.dow >= 0 && r.dow < 7 && r.hour >= 0 && r.hour < 24) {
        g[r.dow][r.hour] = r.n;
        if (r.n > max) max = r.n;
      }
    }
    return { grid: g, max };
  }, [data]);
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const [hover, setHover] = useState<{ dow: number; hour: number; x: number; y: number } | null>(null);
  const hoverTop = hover && topSessions ? topSessions[`${hover.dow},${hover.hour}`] : null;

  function onCellEnter(e: React.MouseEvent, dow: number, hour: number) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setHover({ dow, hour, x: rect.left + rect.width / 2, y: rect.top });
  }

  return (
    <div className="overflow-x-auto relative">
      <div className="inline-grid" style={{ gridTemplateColumns: "auto repeat(24, 1fr)", gap: "2px" }}>
        <div />
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={h} className="text-[9px] text-mutedfg text-center">{h%6===0?h:""}</div>
        ))}
        {days.map((d, i) => (
          <>
            <div key={`d${i}`} className="text-[10px] text-mutedfg pr-2 self-center">{d}</div>
            {grid[i].map((n, h) => {
              const intensity = max ? n / max : 0;
              const bg = n === 0 ? "hsl(var(--muted))" : `hsla(265, 85%, ${70 - intensity*45}%, ${0.3 + intensity*0.7})`;
              return (
                <div key={`${i}-${h}`}
                     className="heatmap-cell aspect-square rounded-sm cursor-default"
                     style={{ background: bg, minWidth: 12, minHeight: 12 }}
                     onMouseEnter={topSessions ? (e) => onCellEnter(e, i, h) : undefined}
                     onMouseLeave={topSessions ? () => setHover(null) : undefined}
                     title={topSessions ? undefined : `${d} ${h}:00 — ${n}`} />
              );
            })}
          </>
        ))}
      </div>
      {hover && hoverTop && hoverTop.length > 0 && (
        <div className="fixed z-50 pointer-events-none rounded border border-border bg-card shadow-2xl px-3 py-2 text-xs"
             style={{ left: hover.x, top: hover.y - 10, transform: "translate(-50%, -100%)" }}>
          <div className="font-semibold text-fg mb-1.5">
            {days[hover.dow]} {String(hover.hour).padStart(2, "0")}:00 · <span className="text-accent tabular-nums">{grid[hover.dow][hover.hour]} prompts</span>
          </div>
          <div className="text-mutedfg text-[10px] uppercase tracking-wide mb-0.5">Top sessions</div>
          <ul className="space-y-0.5">
            {hoverTop.map(s => (
              <li key={s.session_id} className="flex items-baseline gap-2">
                <span className="text-accent font-mono">{s.slug || s.session_id.slice(0, 8)}</span>
                <span className="text-mutedfg tabular-nums ml-auto">{s.n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
