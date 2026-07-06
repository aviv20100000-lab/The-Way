import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { buildCoachInsights, type InsightClientInput, type InsightMealInput, type InsightStepsInput, type InsightWeightInput } from "@/lib/coach-insights";

function proteinFromAiResponse(value: unknown) {
  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed?.items)) return 0;
    return parsed.items.reduce((sum: number, item: Record<string, unknown>) => {
      const protein = Number(item.protein_g ?? item.protein ?? 0);
      return sum + (Number.isFinite(protein) ? protein : 0);
    }, 0);
  } catch {
    return 0;
  }
}

export async function GET() {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  await initDb();
  const [clientsRes, aiMealsRes, quickMealsRes, weightsRes, stepsRes] = await Promise.all([
    db.execute({
      sql: `SELECT u.id, u.name, u.avatar_url, u.created_at,
                   g.daily_calories, g.daily_protein_g, g.daily_steps,
                   g.target_weight_kg, g.weigh_in_frequency_weeks
            FROM users u
            LEFT JOIN goals g ON g.user_id = u.id
            WHERE u.role = 'client' AND u.coach_id = ?
            ORDER BY u.name COLLATE NOCASE ASC`,
      args: [coach.id],
    }),
    db.execute({
      sql: `SELECT aml.user_id, aml.total_calories, aml.ai_response, aml.logged_at
            FROM ai_meal_logs aml
            JOIN users u ON u.id = aml.user_id
            WHERE u.role = 'client' AND u.coach_id = ?
              AND aml.logged_at >= datetime('now', '-30 days')
            ORDER BY aml.logged_at ASC`,
      args: [coach.id],
    }),
    db.execute({
      sql: `SELECT m.user_id, m.logged_at,
                   ROUND(SUM(mi.quantity * f.calories / 100.0)) AS total_calories,
                   ROUND(SUM(mi.quantity * f.protein / 100.0), 1) AS protein_g
            FROM meals m
            JOIN users u ON u.id = m.user_id
            JOIN meal_items mi ON mi.meal_id = m.id
            JOIN foods f ON f.id = mi.food_id
            WHERE u.role = 'client' AND u.coach_id = ?
              AND m.logged_at >= datetime('now', '-30 days')
            GROUP BY m.id, m.user_id, m.logged_at
            ORDER BY m.logged_at ASC`,
      args: [coach.id],
    }),
    db.execute({
      sql: `SELECT wl.user_id, wl.weight_kg, wl.logged_at
            FROM weight_logs wl
            JOIN users u ON u.id = wl.user_id
            WHERE u.role = 'client' AND u.coach_id = ?
              AND wl.logged_at >= datetime('now', '-90 days')
            ORDER BY wl.logged_at ASC`,
      args: [coach.id],
    }),
    db.execute({
      sql: `SELECT sl.user_id, sl.steps, sl.logged_at
            FROM steps_logs sl
            JOIN users u ON u.id = sl.user_id
            WHERE u.role = 'client' AND u.coach_id = ?
              AND sl.logged_at >= datetime('now', '-30 days')
            ORDER BY sl.logged_at ASC`,
      args: [coach.id],
    }),
  ]);

  const clients: InsightClientInput[] = clientsRes.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    created_at: String(row.created_at),
    daily_calories: row.daily_calories === null ? null : Number(row.daily_calories),
    daily_protein_g: row.daily_protein_g === null ? null : Number(row.daily_protein_g),
    daily_steps: row.daily_steps === null ? null : Number(row.daily_steps),
    target_weight_kg: row.target_weight_kg === null ? null : Number(row.target_weight_kg),
    weigh_in_frequency_weeks: row.weigh_in_frequency_weeks === null ? null : Number(row.weigh_in_frequency_weeks),
  }));

  const aiMeals: InsightMealInput[] = aiMealsRes.rows.map((row) => ({
    user_id: String(row.user_id),
    total_calories: Number(row.total_calories) || 0,
    protein_g: proteinFromAiResponse(row.ai_response),
    logged_at: String(row.logged_at),
  }));
  const quickMeals: InsightMealInput[] = quickMealsRes.rows.map((row) => ({
    user_id: String(row.user_id),
    total_calories: Number(row.total_calories) || 0,
    protein_g: Number(row.protein_g) || 0,
    logged_at: String(row.logged_at),
  }));
  const weights: InsightWeightInput[] = weightsRes.rows.map((row) => ({
    user_id: String(row.user_id),
    weight_kg: Number(row.weight_kg),
    logged_at: String(row.logged_at),
  }));
  const steps: InsightStepsInput[] = stepsRes.rows.map((row) => ({
    user_id: String(row.user_id),
    steps: Number(row.steps) || 0,
    logged_at: String(row.logged_at),
  }));

  return NextResponse.json(
    buildCoachInsights({ clients, meals: [...aiMeals, ...quickMeals], weights, steps }),
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
