import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import db, { initDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const formData = await req.formData();
  const weight = parseFloat(formData.get("weight") as string);

  if (!weight || weight <= 0 || weight > 500) {
    return NextResponse.json({ error: "משקל לא תקין (0-500 ק״ג)" }, { status: 400 });
  }

  const logId = uuid();
  await db.execute({
    sql: `INSERT INTO weight_logs (id, user_id, weight_kg, logged_at)
          VALUES (?, ?, ?, datetime('now'))`,
    args: [logId, user.id, weight],
  });

  return NextResponse.json({ id: logId, weight_kg: weight });
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const days = req.nextUrl.searchParams.get("days") || "90";
  const daysNum = Math.max(1, Math.min(365, parseInt(days, 10)));

  const logsRes = await db.execute({
    sql: `SELECT * FROM weight_logs
          WHERE user_id = ?
          AND logged_at >= datetime('now', '-' || CAST(? AS TEXT) || ' days')
          ORDER BY logged_at DESC`,
    args: [user.id, daysNum],
  });

  const goalRes = await db.execute({
    sql: "SELECT target_weight_kg FROM goals WHERE user_id = ?",
    args: [user.id],
  });

  const logs = logsRes.rows.reverse();
  const target = goalRes.rows[0]?.target_weight_kg || null;

  return NextResponse.json({ logs, target });
}
