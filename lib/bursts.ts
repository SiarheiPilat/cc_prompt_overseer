export type Burst = { start: number; end: number; prompts: number; tokens: number };

export function computeBursts(timestamps: number[], idleGapMs = 15 * 60 * 1000): Burst[] {
  if (!timestamps.length) return [];
  const sorted = [...timestamps].filter(t => t > 0).sort((a, b) => a - b);
  if (!sorted.length) return [];
  const out: Burst[] = [];
  let start = sorted[0];
  let last = sorted[0];
  let count = 1;
  for (let i = 1; i < sorted.length; i++) {
    const t = sorted[i];
    if (t - last > idleGapMs) {
      out.push({ start, end: last, prompts: count, tokens: 0 });
      start = t; count = 1;
    } else {
      count++;
    }
    last = t;
  }
  out.push({ start, end: last, prompts: count, tokens: 0 });
  return out;
}

export function burstSummary(bursts: Burst[], sessionStart: number, sessionEnd: number) {
  const activeMs = bursts.reduce((s, b) => s + Math.max(0, b.end - b.start), 0);
  const wallMs = Math.max(0, (sessionEnd || 0) - (sessionStart || 0));
  const largest = bursts.reduce((m, b) => b.prompts > (m?.prompts || 0) ? b : m, bursts[0]);
  return {
    count: bursts.length,
    activeMs, wallMs,
    activeRatio: wallMs ? activeMs / wallMs : 0,
    largest,
  };
}

export function fmtDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m`;
  const h = Math.floor(ms / 3600_000);
  const m = Math.round((ms % 3600_000) / 60_000);
  return m ? `${h}h ${m}m` : `${h}h`;
}
