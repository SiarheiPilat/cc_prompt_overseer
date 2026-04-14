import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ error: "missing slug" }, { status: 400 });
  const row = db().prepare(`SELECT slug, starred, note, tags FROM plan_meta WHERE slug=?`).get(slug);
  return NextResponse.json(row || { slug, starred: 0, note: null, tags: null });
}

export async function POST(req: Request) {
  const body = await req.json();
  const slug = String(body.slug || "");
  if (!slug) return NextResponse.json({ error: "missing slug" }, { status: 400 });
  const D = db();
  const cur = D.prepare(`SELECT starred, note, tags FROM plan_meta WHERE slug=?`).get(slug) as any;
  let nextTags = cur?.tags ?? null;
  if (body.tags != null) {
    if (Array.isArray(body.tags)) {
      const cleaned = Array.from(new Set(body.tags
        .filter((t: any) => typeof t === "string")
        .map((t: string) => t.trim().toLowerCase())
        .filter((t: string) => t && t.length <= 40)));
      nextTags = cleaned.length ? JSON.stringify(cleaned) : null;
    } else if (typeof body.tags === "string") {
      const cleaned = Array.from(new Set(body.tags.split(",").map(t => t.trim().toLowerCase()).filter(t => t && t.length <= 40)));
      nextTags = cleaned.length ? JSON.stringify(cleaned) : null;
    }
  }
  const next = {
    starred: body.starred != null ? Number(body.starred) : cur?.starred ?? 0,
    note: body.note != null ? String(body.note) : cur?.note ?? null,
    tags: nextTags,
  };
  D.prepare(`
    INSERT INTO plan_meta(slug,starred,note,tags)
    VALUES(?,?,?,?)
    ON CONFLICT(slug) DO UPDATE SET starred=excluded.starred, note=excluded.note, tags=excluded.tags
  `).run(slug, next.starred, next.note, next.tags);
  return NextResponse.json({ ok: true });
}
