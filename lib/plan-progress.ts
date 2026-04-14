export type CheckboxItem = { text: string; done: boolean; line: number };
export type PlanProgress = {
  hasCheckboxes: boolean;
  total: number;
  done: number;
  percent: number;
  items: CheckboxItem[];
  nextItems: CheckboxItem[];
};

const RE = /^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/;

export function parsePlanProgress(body: string): PlanProgress {
  const items: CheckboxItem[] = [];
  if (!body) return { hasCheckboxes: false, total: 0, done: 0, percent: 0, items, nextItems: [] };
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = RE.exec(lines[i]);
    if (!m) continue;
    items.push({ text: m[2].trim(), done: m[1] !== " ", line: i + 1 });
  }
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const percent = total > 0 ? done / total : 0;
  const nextItems = items.filter(i => !i.done).slice(0, 5);
  return { hasCheckboxes: total > 0, total, done, percent, items, nextItems };
}
