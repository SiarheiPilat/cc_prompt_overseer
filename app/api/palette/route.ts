import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchFTS } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ items: [] });
  const D = db();
  const items: any[] = [];

  // projects
  const projs = D.prepare(`SELECT id, cwd FROM projects WHERE cwd LIKE ? OR id LIKE ? LIMIT 6`)
    .all(`%${q}%`, `%${q}%`) as any[];
  for (const p of projs) {
    items.push({ id: `proj:${p.id}`, label: p.cwd || p.id, hint: "project", href: `/projects/${encodeURIComponent(p.id)}` });
  }

  // plans
  const plans = D.prepare(`SELECT slug, title FROM plans WHERE title LIKE ? OR slug LIKE ? LIMIT 6`)
    .all(`%${q}%`, `%${q}%`) as any[];
  for (const p of plans) {
    items.push({ id: `plan:${p.slug}`, label: p.title || p.slug, hint: "plan", href: `/plans/${encodeURIComponent(p.slug)}` });
  }

  // prompts
  const hits = searchFTS(q, 10) as any[];
  for (const h of hits) {
    const clean = (h.snippet || "").replace(/<\/?b>/g, "");
    items.push({ id: `p:${h.id}`, label: clean.slice(0, 120), hint: "prompt", href: `/sessions/${h.session_id}#p${h.id}` });
  }

  return NextResponse.json({ items });
}
