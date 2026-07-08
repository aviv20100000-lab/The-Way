import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

// Combined home endpoint — replaces 4 separate API calls with 1
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const u = user as { id: string; coach_id?: string; role: string };
  const today = new Date().toISOString().split("T")[0];

  // All DB queries in parallel — single session lookup, single initDb
  const [quotesRes, waterRes, goalsRes, streakRes, stepsRes, caloriesRes, totalStepsRes, profileRes] = await Promise.all([
    db.execute("SELECT text FROM quotes WHERE active = 1"),
    db.execute({
      sql: "SELECT amount_ml FROM water_logs WHERE user_id = ? AND DATE(logged_at) = ?",
      args: [u.id, today],
    }),
    db.execute({
      sql: "SELECT target_weight_kg, daily_water_ml, daily_calories, daily_protein_g, daily_steps FROM goals WHERE user_id = ?",
      args: [u.id],
    }),
    db.execute({
      sql: "SELECT current_streak, last_completed_date, best_streak FROM water_streak WHERE user_id = ?",
      args: [u.id],
    }),
    db.execute({
      sql: "SELECT COALESCE(SUM(steps), 0) as steps FROM steps_logs WHERE user_id = ? AND DATE(logged_at) = ?",
      args: [u.id, today],
    }),
    db.execute({
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
      args: [u.id, today, u.id, today],
    }),
    db.execute({
      sql: "SELECT COALESCE(SUM(steps), 0) as total_steps FROM steps_logs WHERE user_id = ?",
      args: [u.id],
    }),
    db.execute({
      sql: "SELECT created_at FROM users WHERE id = ?",
      args: [u.id],
    }),
  ]);

  const quotes = (quotesRes.rows as unknown as { text: string }[]).map((r) => r.text).filter(Boolean);
  const waterLogs = waterRes.rows as unknown as { amount_ml: number }[];
  const waterTotal = waterLogs.reduce((s, l) => s + l.amount_ml, 0);
  const waterGoal = (goalsRes.rows[0]?.daily_water_ml as number) || 2000;
  const calGoal = (goalsRes.rows[0]?.daily_calories as number) || null;
  const goalsRow = goalsRes.rows[0] || null;
  const streakRow = streakRes.rows[0] || {};
  const profileRow = profileRes.rows[0] || {};
  const createdAt = profileRow.created_at ? String(profileRow.created_at) : null;
  const daysSinceSignup = createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(`${createdAt.replace(" ", "T")}Z`).getTime()) / 86400000))
    : 0;

  return NextResponse.json({
    quotes,
    days_since_signup: daysSinceSignup,
    total_steps: (totalStepsRes.rows[0]?.total_steps as number) || 0,
    water: {
      total: waterTotal,
      goal: waterGoal,
      streak: {
        current_streak: streakRow.current_streak ?? 0,
        last_completed_date: streakRow.last_completed_date ?? null,
        best_streak: streakRow.best_streak ?? 0,
        goal_reached_today: waterTotal >= waterGoal,
      },
    },
    steps: (stepsRes.rows[0]?.steps as number) || 0,
    steps_goal: (goalsRes.rows[0]?.daily_steps as number) || 10000,
    calories: {
      total: Math.round((caloriesRes.rows[0]?.total_calories as number) ?? 0),
      goal: calGoal,
    },
    protein_goal: (goalsRes.rows[0]?.daily_protein_g as number) || null,
    goal_status: {
      target_weight: goalsRow?.target_weight_kg != null,
      calories: goalsRow?.daily_calories != null,
      protein: goalsRow?.daily_protein_g != null,
      water: goalsRow?.daily_water_ml != null,
      steps: goalsRow?.daily_steps != null,
    },
  });
}
