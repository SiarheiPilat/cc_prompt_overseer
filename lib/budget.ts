import { getMeta } from "./db";
import { tokenSpend } from "./queries";
import { costUSD } from "./pricing";

export type Budget = { weekly: number; monthly: number };

export function getBudget(): Budget {
  const w = Number(getMeta("budget_weekly_usd") || 0);
  const m = Number(getMeta("budget_monthly_usd") || 0);
  return {
    weekly: isFinite(w) && w > 0 ? w : 0,
    monthly: isFinite(m) && m > 0 ? m : 0,
  };
}

export function spendInRange(fromMs: number, toMs: number): number {
  const rows = tokenSpend(fromMs, toMs);
  return rows.reduce((sum: number, r: any) =>
    sum + costUSD(r.model, r.input || 0, r.output || 0, r.cache_creation || 0, r.cache_read || 0),
  0);
}

export function thisWeekRange(): { from: number; to: number } {
  const now = new Date();
  const day = (now.getUTCDay() || 7) - 1; // Mon=0
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day);
  return { from: start, to: start + 7 * 86400000 };
}

export function thisMonthRange(): { from: number; to: number } {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return { from: start, to: end };
}

export function budgetState() {
  const budget = getBudget();
  const w = thisWeekRange();
  const m = thisMonthRange();
  const weekSpend = spendInRange(w.from, w.to);
  const monthSpend = spendInRange(m.from, m.to);
  return {
    budget,
    weekSpend,
    monthSpend,
    weekPct: budget.weekly > 0 ? weekSpend / budget.weekly : 0,
    monthPct: budget.monthly > 0 ? monthSpend / budget.monthly : 0,
  };
}
