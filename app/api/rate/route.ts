import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json();
  const uuid = String(body.uuid || "");
  if (!uuid) return NextResponse.json({ ok: false, error: "missing uuid" }, { status: 400 });
  const D = db();
  const cur = D.prepare("SELECT uuid, starred, rating, note, hidden, tags FROM user_meta WHERE uuid=?").get(uuid) as any;
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
    rating: body.rating != null ? Number(body.rating) : cur?.rating ?? 0,
    note: body.note != null ? String(body.note) : cur?.note ?? null,
    hidden: body.hidden != null ? Number(body.hidden) : cur?.hidden ?? 0,
    tags: nextTags,
  };
  D.prepare(`
    INSERT INTO user_meta(uuid,starred,rating,note,hidden,tags)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(uuid) DO UPDATE SET starred=excluded.starred, rating=excluded.rating, note=excluded.note, hidden=excluded.hidden, tags=excluded.tags
  `).run(uuid, next.starred, next.rating, next.note, next.hidden, next.tags);
  return NextResponse.json({ ok: true });
}
