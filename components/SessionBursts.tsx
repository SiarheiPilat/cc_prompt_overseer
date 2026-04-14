"use client";
import { useMemo } from "react";
import { computeBursts, burstSummary, fmtDuration, type Burst } from "@/lib/bursts";
import { fmtDate } from "@/lib/utils";

export function SessionBursts({
  promptTimestamps, sessionStart, sessionEnd,
}: {
  promptTimestamps: number[]; sessionStart: number; sessionEnd: number;
}) {
  const { bursts, sum } = useMemo(() => {
    const b = computeBursts(promptTimestamps);
    return { bursts: b, sum: burstSummary(b, sessionStart, sessionEnd) };
  }, [promptTimestamps, sessionStart, sessionEnd]);

  if (!bursts.length) return null;
  const totalMs = Math.max(1, (sessionEnd || promptTimestamps[promptTimestamps.length - 1] || 0) - (sessionStart || promptTimestamps[0] || 0));
  const viewStart = sessionStart || bursts[0].start;
  const maxPrompts = bursts.reduce((m, b) => Math.max(m, b.prompts), 1);

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <Stat label="Bursts" value={String(sum.count)} />
        <Stat label="Biggest burst" value={`${sum.largest?.prompts ?? 0} prompts`} />
        <Stat label="Active time" value={fmtDuration(sum.activeMs)} sub={`of ${fmtDuration(sum.wallMs)} wall`} />
        <Stat label="Focus ratio" value={`${(sum.activeRatio * 100).toFixed(0)}%`} sub="active / wall" />
      </div>
      <div className="relative mt-2 h-6 rounded bg-muted/60 overflow-hidden" title="activity strip — wider segments = longer bursts; taller opacity = more prompts">
        {bursts.map((b, i) => {
          const left = ((b.start - viewStart) / totalMs) * 100;
          const width = Math.max(0.6, ((b.end - b.start) / totalMs) * 100);
          const intensity = b.prompts / maxPrompts;
          return (
            <div key={i}
              className="absolute top-0 bottom-0 hover:ring-1 hover:ring-accent"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: `hsla(265, 85%, ${70 - intensity * 35}%, ${0.4 + intensity * 0.5})`,
              }}
              title={`${fmtDate(b.start)} → ${fmtDate(b.end)} · ${b.prompts} prompts · ${fmtDuration(b.end - b.start)}`} />
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-mutedfg">{label}:</span>
      <span className="font-semibold tabular-nums">{value}</span>
      {sub && <span className="text-[10px] text-mutedfg">({sub})</span>}
    </div>
  );
}
