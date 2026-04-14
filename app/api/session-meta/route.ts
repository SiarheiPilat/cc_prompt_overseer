import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const row = db().prepare(`SELECT session_id, starred, note, tags FROM session_meta WHERE session_id=?`).get(id);
  return NextResponse.json(row || { session_id: id, starred: 0, note: null, tags: null });
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = String(body.session_id || body.id || "");
  if (!id) return NextResponse.json({ error: "missing session_id" }, { status: 400 });
  const D = db();
  const cur = D.prepare(`SELECT starred, note, tags FROM session_meta WHERE session_id=?`).get(id) as any;
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
    INSERT INTO session_meta(session_id,starred,note,tags)
    VALUES(?,?,?,?)
    ON CONFLICT(session_id) DO UPDATE SET
      starred=excluded.starred, note=excluded.note, tags=excluded.tags
  `).run(id, next.starred, next.note, next.tags);
  return NextResponse.json({ ok: true });
}
