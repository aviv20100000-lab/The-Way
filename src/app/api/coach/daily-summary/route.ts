import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDailySummary, getYesterdayDayKey } from "@/lib/daily-summary";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const day = req.nextUrl.searchParams.get("day") || getYesterdayDayKey();
  const summary = await getDailySummary(coach.id, day);

  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
