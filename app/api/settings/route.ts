import { NextResponse } from "next/server";
import { setMeta, getMeta } from "@/lib/db";

export const runtime = "nodejs";

const KEYS = ["budget_weekly_usd", "budget_monthly_usd"];

export async function GET() {
  const obj: Record<string, string | null> = {};
  for (const k of KEYS) obj[k] = getMeta(k);
  return NextResponse.json(obj);
}

export async function POST(req: Request) {
  const body = await req.json();
  for (const k of KEYS) {
    if (body[k] != null) {
      const v = String(body[k]).trim();
      // store empty as ""
      setMeta(k, v);
    }
  }
  return NextResponse.json({ ok: true });
}
