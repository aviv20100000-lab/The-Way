import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { getDayRangeUtc, getTodayDayKey } from "@/lib/daily-summary";

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

  const { startUtc, endUtc } = getDayRangeUtc(getTodayDayKey());

  const [weightRes, stepsRes, waterRes, aiMealsRes, quickMealsRes, goalRes] = await Promise.all([
    db.execute({
      sql: `SELECT weight_kg, strftime('%Y-%m-%dT%H:%M:%SZ', logged_at) AS logged_at FROM weight_logs
            WHERE user_id = ? ORDER BY logged_at DESC LIMIT 12`,
      args: [userId],
    }),
    db.execute({
      sql: `SELECT COALESCE(SUM(steps), 0) AS steps FROM steps_logs
            WHERE user_id = ? AND logged_at >= ? AND logged_at < ?`,
      args: [userId, startUtc, endUtc],
    }),
    db.execute({
      sql: `SELECT COALESCE(SUM(amount_ml), 0) AS total FROM water_logs
            WHERE user_id = ? AND logged_at >= ? AND logged_at < ?`,
      args: [userId, startUtc, endUtc],
    }),
    db.execute({
      sql: `SELECT id, total_calories, ai_response,
                   strftime('%Y-%m-%dT%H:%M:%SZ', logged_at) AS logged_at
            FROM ai_meal_logs
            WHERE user_id = ? AND logged_at >= datetime('now', '-35 days')
            ORDER BY logged_at DESC LIMIT 300`,
      args: [userId],
    }),
    db.execute({
      sql: `SELECT m.id,
                   strftime('%Y-%m-%dT%H:%M:%SZ', m.logged_at) AS logged_at,
                   ROUND(SUM(mi.quantity * f.calories / 100.0)) AS total_calories,
                   GROUP_CONCAT(
                     f.name_he || ':' || ROUND(mi.quantity * f.calories / 100.0) || ':' ||
                     mi.quantity || ':' || ROUND(mi.quantity * f.protein / 100.0, 1),
                     '|'
                   ) AS items_raw
            FROM meals m
            JOIN meal_items mi ON mi.meal_id = m.id
            JOIN foods f ON f.id = mi.food_id
            WHERE m.user_id = ? AND m.logged_at >= datetime('now', '-35 days')
            GROUP BY m.id, m.logged_at
            ORDER BY m.logged_at DESC LIMIT 300`,
      args: [userId],
    }),
    db.execute({
      sql: "SELECT target_weight_kg, daily_calories, daily_protein_g, daily_water_ml, daily_steps FROM goals WHERE user_id = ?",
      args: [userId],
    }),
  ]);

  const weights = weightRes.rows.map((r) => ({
    weight_kg: r.weight_kg as number,
    logged_at: r.logged_at as string,
  }));

  const aiMeals = aiMealsRes.rows.map((r) => ({
    id: r.id as string,
    total_calories: r.total_calories as number,
    logged_at: r.logged_at as string,
    source: "ai" as const,
    items: (() => {
      try {
        return JSON.parse(r.ai_response as string).items ?? [];
      } catch {
        return [];
      }
    })(),
  }));

  const quickMeals = quickMealsRes.rows.map((r) => ({
    id: String(r.id),
    total_calories: Math.round(Number(r.total_calories) || 0),
    logged_at: String(r.logged_at),
    source: "quick" as const,
    items: String(r.items_raw || "").split("|").filter(Boolean).map((segment) => {
      const [name, calories, grams, protein] = segment.split(":");
      return {
        name: name || "פריט",
        calories: Math.round(Number(calories) || 0),
        estimated_weight_g: Math.round(Number(grams) || 0),
        protein_g: Number(protein) || 0,
      };
    }),
  }));

  const meals = [...aiMeals, ...quickMeals].sort(
    (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
  );

  const goal = goalRes.rows[0] ?? {};

  return NextResponse.json({
    weights,
    steps_today: (stepsRes.rows[0]?.steps as number) || 0,
    water_today: (waterRes.rows[0]?.total as number) || 0,
    meals,
    goals: {
      target_weight_kg: (goal.target_weight_kg as number) ?? null,
      daily_calories: (goal.daily_calories as number) ?? null,
      daily_protein_g: (goal.daily_protein_g as number) ?? null,
      daily_water_ml: (goal.daily_water_ml as number) ?? 2000,
      daily_steps: (goal.daily_steps as number) ?? null,
    },
  });
}
