import { NextResponse } from "next/server";
import { indexAll } from "@/lib/indexer";
import { invalidateSimilarity } from "@/lib/similarity";
import { invalidateQueryCaches } from "@/lib/queries";

export const runtime = "nodejs";

export async function POST() {
  const stats = indexAll();
  invalidateSimilarity();
  invalidateQueryCaches();
  return NextResponse.json(stats);
}
