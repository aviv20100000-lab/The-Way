import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import { validateWater } from "@/lib/validation";
import db, { initDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const { amount_ml = 250 } = await req.json();

  if (!validateWater(amount_ml)) {
    return NextResponse.json({ error: "כמות מים לא תקינה (1-5000ml)" }, { status: 400 });
  }

  const logId = uuid();
  await db.execute({
    sql: `INSERT INTO water_logs (id, user_id, amount_ml, logged_at)
          VALUES (?, ?, ?, datetime('now'))`,
    args: [logId, user.id, amount_ml],
  });

  return NextResponse.json({ id: logId, amount_ml });
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const today = new Date().toISOString().split("T")[0];
  
  const logsRes = await db.execute({
    sql: `SELECT * FROM water_logs
          WHERE user_id = ? AND DATE(logged_at) = ?
          ORDER BY logged_at DESC`,
    args: [user.id, today],
  });

  const goalRes = await db.execute({
    sql: "SELECT daily_water_ml FROM goals WHERE user_id = ?",
    args: [user.id],
  });

  const total = (logsRes.rows as unknown as Array<{ amount_ml: number }>).reduce((sum, log) => sum + log.amount_ml, 0);
  const goal = (goalRes.rows[0]?.daily_water_ml as number) || 2000;

  return NextResponse.json({ 
    logs: logsRes.rows,
    total_ml: total,
    goal_ml: goal,
  });
}
