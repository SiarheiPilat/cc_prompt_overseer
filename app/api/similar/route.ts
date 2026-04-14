import { NextResponse } from "next/server";
import { similarTo } from "@/lib/similarity";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const uuid = url.searchParams.get("uuid") || "";
  const limit = Math.min(15, Math.max(1, Number(url.searchParams.get("limit") || 5)));
  if (!uuid) return NextResponse.json({ results: [] });
  const t0 = Date.now();
  const results = similarTo(uuid, limit);
  return NextResponse.json({ results, ms: Date.now() - t0 });
}
