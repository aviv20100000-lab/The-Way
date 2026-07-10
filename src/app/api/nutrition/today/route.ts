import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const today = new Date().toISOString().split("T")[0];

  const res = await db.execute({
    sql: `SELECT
            COALESCE((
              SELECT ROUND(SUM(mi.quantity * f.calories / 100.0))
              FROM meals m
              JOIN meal_items mi ON mi.meal_id = m.id
              JOIN foods f ON f.id = mi.food_id
              WHERE m.user_id = ? AND DATE(m.logged_at) = ?
            ), 0)
            +
            COALESCE((
              SELECT ROUND(SUM(total_calories))
              FROM ai_meal_logs
              WHERE user_id = ? AND DATE(logged_at) = ?
            ), 0) AS total_calories`,
    args: [user.id, today, user.id, today],
  });

  const goalRes = await db.execute({
    sql: "SELECT daily_calories FROM goals WHERE user_id = ?",
    args: [user.id],
  });

  return NextResponse.json({
    total_calories: Math.round((res.rows[0]?.total_calories as number) ?? 0),
    goal_calories: (goalRes.rows[0]?.daily_calories as number) ?? null,
  });
}
