import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  await initDb();
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "חסר מזהה מתאמן" }, { status: 400 });

  // Verify this client belongs to the coach
  const ownerRes = await db.execute({
    sql: "SELECT coach_id FROM users WHERE id = ?",
    args: [userId],
  });
  const owner = ownerRes.rows[0];
  if (!owner || owner.coach_id !== coach.id) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const today = new Date().toISOString().split("T")[0];

  const [weightRes, stepsRes, waterRes, mealsRes, goalRes] = await Promise.all([
    db.execute({
      sql: `SELECT weight_kg, logged_at FROM weight_logs
            WHERE user_id = ? ORDER BY logged_at DESC LIMIT 12`,
      args: [userId],
    }),
    db.execute({
      sql: `SELECT COALESCE(SUM(steps), 0) AS steps FROM steps_logs
            WHERE user_id = ? AND DATE(logged_at) = ?`,
      args: [userId, today],
    }),
    db.execute({
      sql: `SELECT COALESCE(SUM(amount_ml), 0) AS total FROM water_logs
            WHERE user_id = ? AND DATE(logged_at) = ?`,
      args: [userId, today],
    }),
    db.execute({
      sql: `SELECT id, total_calories, ai_response, logged_at FROM ai_meal_logs
            WHERE user_id = ? AND logged_at >= datetime('now', '-7 days')
            ORDER BY logged_at DESC LIMIT 20`,
      args: [userId],
    }),
    db.execute({
      sql: "SELECT target_weight_kg, daily_calories, daily_water_ml FROM goals WHERE user_id = ?",
      args: [userId],
    }),
  ]);

  const weights = weightRes.rows.map((r) => ({
    weight_kg: r.weight_kg as number,
    logged_at: r.logged_at as string,
  }));

  const meals = mealsRes.rows.map((r) => ({
    id: r.id as string,
    total_calories: r.total_calories as number,
    logged_at: r.logged_at as string,
    items: (() => {
      try {
        return JSON.parse(r.ai_response as string).items ?? [];
      } catch {
        return [];
      }
    })(),
  }));

  const goal = goalRes.rows[0] ?? {};

  return NextResponse.json({
    weights,
    steps_today: (stepsRes.rows[0]?.steps as number) || 0,
    water_today: (waterRes.rows[0]?.total as number) || 0,
    meals,
    goals: {
      target_weight_kg: (goal.target_weight_kg as number) ?? null,
      daily_calories: (goal.daily_calories as number) ?? null,
      daily_water_ml: (goal.daily_water_ml as number) ?? 2000,
    },
  });
}
