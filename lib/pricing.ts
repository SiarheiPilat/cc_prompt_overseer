// Per-million-token prices in USD. Public list prices from Anthropic; updated 2026-04.
// If you use Claude Code through different billing, override via env or just treat costs as relative indicators.
type Pricing = { input: number; output: number; cacheWrite: number; cacheRead: number };

const TABLE: Record<string, Pricing> = {
  "claude-opus-4-6":     { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 },
  "claude-opus-4-5":     { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 },
  "claude-opus-4":       { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 },
  "claude-sonnet-4-6":   { input: 3,  output: 15, cacheWrite: 3.75,  cacheRead: 0.30 },
  "claude-sonnet-4-5":   { input: 3,  output: 15, cacheWrite: 3.75,  cacheRead: 0.30 },
  "claude-sonnet-4":     { input: 3,  output: 15, cacheWrite: 3.75,  cacheRead: 0.30 },
  "claude-haiku-4-5":    { input: 0.80, output: 4, cacheWrite: 1, cacheRead: 0.08 },
  "claude-haiku-4":      { input: 0.80, output: 4, cacheWrite: 1, cacheRead: 0.08 },
  "claude-3-5-sonnet":   { input: 3,  output: 15, cacheWrite: 3.75,  cacheRead: 0.30 },
  "claude-3-5-haiku":    { input: 0.80, output: 4, cacheWrite: 1, cacheRead: 0.08 },
  "claude-3-opus":       { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 },
};

function lookup(model: string | null | undefined): Pricing {
  if (!model) return TABLE["claude-sonnet-4-6"]; // safe default
  // strip suffixes like "[1m]" "-20251022"
  const m = model.toLowerCase().replace(/\[[^\]]+\]/g, "").replace(/-2\d{7}/g, "");
  for (const key of Object.keys(TABLE)) {
    if (m.startsWith(key)) return TABLE[key];
  }
  // best-effort fallback by family
  if (m.includes("opus")) return TABLE["claude-opus-4-6"];
  if (m.includes("haiku")) return TABLE["claude-haiku-4-5"];
  return TABLE["claude-sonnet-4-6"];
}

export function costUSD(
  model: string | null,
  input_tokens: number, output_tokens: number,
  cache_creation: number = 0, cache_read: number = 0,
): number {
  const p = lookup(model);
  return (
    (input_tokens * p.input) +
    (output_tokens * p.output) +
    (cache_creation * p.cacheWrite) +
    (cache_read * p.cacheRead)
  ) / 1_000_000;
}

export function fmtCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  if (usd > 0) return `$${usd.toFixed(4)}`;
  return "$0";
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
