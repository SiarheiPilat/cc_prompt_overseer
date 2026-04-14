import { NextResponse } from "next/server";
import { getPromptFull } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id") || 0);
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const row = getPromptFull(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(row);
}
