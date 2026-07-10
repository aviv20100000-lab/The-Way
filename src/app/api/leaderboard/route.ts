import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const periodParam = req.nextUrl.searchParams.get("period") || "daily";
  const period = periodParam === "weekly" ? "weekly" : "daily";
  const coachId = user.role === "coach" ? user.id : user.coach_id;

  const sql = period === "weekly"
    ? `SELECT u.id, u.name, COALESCE(SUM(s.steps), 0) as total_steps, COUNT(DISTINCT DATE(s.logged_at)) as days_logged FROM users u LEFT JOIN steps_logs s ON u.id = s.user_id AND s.logged_at >= datetime('now', 'weekday 0', '-7 days') WHERE u.coach_id = ? GROUP BY u.id ORDER BY total_steps DESC`
    : `SELECT u.id, u.name, COALESCE(SUM(s.steps), 0) as total_steps, COUNT(DISTINCT DATE(s.logged_at)) as days_logged FROM users u LEFT JOIN steps_logs s ON u.id = s.user_id AND s.logged_at >= datetime('now') WHERE u.coach_id = ? GROUP BY u.id ORDER BY total_steps DESC`;

  const leaderboard = (await db.execute({ sql, args: [coachId] })).rows as unknown as Array<{
    id: string;
    name: string;
    total_steps: number;
    days_logged: number;
  }>;

  return NextResponse.json({ period, leaderboard });
}
