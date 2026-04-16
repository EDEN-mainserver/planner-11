import { NextRequest, NextResponse } from "next/server";
import { readJson } from "@/lib/db";
import type { Reel } from "@/types/reels";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? "all";
  const search = searchParams.get("search") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const PER_PAGE = 12;

  let reels = readJson<Reel>("reels.json");
  if (category !== "all") reels = reels.filter((r) => r.category === category);
  if (search) reels = reels.filter((r) => r.caption.includes(search) || r.hashtags.some((h) => h.includes(search)));

  const total = reels.length;
  const sliced = reels.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return NextResponse.json({ reels: sliced, total, page });
}
