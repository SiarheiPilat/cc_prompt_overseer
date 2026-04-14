import { NextResponse } from "next/server";
import { indexAll } from "@/lib/indexer";
import { invalidateSimilarity } from "@/lib/similarity";

export const runtime = "nodejs";

export async function POST() {
  const stats = indexAll();
  invalidateSimilarity();
  return NextResponse.json(stats);
}
