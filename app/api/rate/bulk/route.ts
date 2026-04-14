import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json();
  const uuids: string[] = Array.isArray(body.uuids) ? body.uuids.filter((x: any) => typeof x === "string" && x) : [];
  if (!uuids.length) return NextResponse.json({ ok: false, error: "no uuids" }, { status: 400 });
  if (uuids.length > 5000) return NextResponse.json({ ok: false, error: "too many" }, { status: 400 });

  const action = String(body.action || "");
  const D = db();

  const upsert = D.prepare(`
    INSERT INTO user_meta(uuid,starred,rating,note,hidden,tags)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(uuid) DO UPDATE SET
      starred=COALESCE(?, user_meta.starred),
      rating=COALESCE(?, user_meta.rating),
      hidden=COALESCE(?, user_meta.hidden)
  `);

  const tx = D.transaction((list: string[]) => {
    for (const u of list) {
      let starred: number | null = null;
      let rating: number | null = null;
      let hidden: number | null = null;
      if (action === "star") starred = 1;
      else if (action === "unstar") starred = 0;
      else if (action === "hide") hidden = 1;
      else if (action === "unhide") hidden = 0;
      else if (action === "rate") rating = Math.max(0, Math.min(5, Number(body.value || 0)));
      else continue;

      // Insert with default zeros, then update with COALESCE on the user-supplied fields
      upsert.run(
        u,
        starred ?? 0, rating ?? 0, null, hidden ?? 0, null,
        starred, rating, hidden,
      );
    }
  });

  tx(uuids);
  return NextResponse.json({ ok: true, count: uuids.length });
}
