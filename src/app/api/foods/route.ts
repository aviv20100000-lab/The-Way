import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { searchFoods } from "@/lib/meals";
import { ensureSeed } from "@/lib/seed";

export async function GET(req: NextRequest) {
  await ensureSeed();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q") || "";
  const foods = await searchFoods(q);
  return NextResponse.json(foods);
}
