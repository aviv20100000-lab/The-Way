import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { v4 as uuid } from "uuid";

export async function GET() {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];
  const row = (await db.execute({ sql: "SELECT COALESCE(SUM(amount_ml),0) as total FROM water_logs WHERE user_id=? AND date(logged_at)=?", args: [session.id, today] })).rows[0];
  const goal = (await db.execute({ sql: "SELECT daily_water_ml FROM goals WHERE user_id=?", args: [session.id] })).rows[0];
  return NextResponse.json({ total_ml: row.total, goal_ml: goal?.daily_water_ml ?? 2000 });
}

export async function POST(req: NextRequest) {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { amount_ml = 250 } = await req.json();
  await db.execute({ sql: "INSERT INTO water_logs (id, user_id, amount_ml) VALUES (?,?,?)", args: [uuid(), session.id, amount_ml] });
  return NextResponse.json({ ok: true });
}
