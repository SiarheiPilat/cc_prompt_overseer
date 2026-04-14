import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const rows = db().prepare(`SELECT id, name, query, created_at FROM playlists ORDER BY created_at DESC`).all();
  return NextResponse.json({ playlists: rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body.name || "").trim().slice(0, 80);
  const query = String(body.query || "").trim().slice(0, 2000);
  if (!name || !query) return NextResponse.json({ ok: false, error: "name and query required" }, { status: 400 });
  const info = db().prepare(`INSERT INTO playlists(name, query, created_at) VALUES(?,?,?)`).run(name, query, Date.now());
  return NextResponse.json({ ok: true, id: info.lastInsertRowid });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id") || 0);
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  db().prepare(`DELETE FROM playlists WHERE id=?`).run(id);
  return NextResponse.json({ ok: true });
}
