import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { getDayRangeUtc, getTodayDayKey } from "@/lib/daily-summary";

// Combined home endpoint — replaces 4 separate API calls with 1
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const u = user as { id: string; coach_id?: string; role: string };
  // "Today" must be the Jerusalem day, matching every other endpoint. A raw UTC
  // date rolls over at 03:00 local time, so the home tab used to show yesterday's
  // totals until 03:00 while /api/health/water already showed the new day.
  const { startUtc, endUtc } = getDayRangeUtc(getTodayDayKey());

  // All DB queries in parallel — single session lookup, single initDb
  const [quotesRes, waterRes, goalsRes, streakRes, stepsRes, caloriesRes, totalStepsRes, profileRes, publishedMenuRes] = await Promise.all([
    db.execute("SELECT text FROM quotes WHERE active = 1"),
    db.execute({
      sql: "SELECT amount_ml FROM water_logs WHERE user_id = ? AND logged_at >= ? AND logged_at < ?",
      args: [u.id, startUtc, endUtc],
    }),
    db.execute({
      sql: "SELECT target_weight_kg, daily_water_ml, daily_calories, daily_protein_g, daily_steps, weigh_in_frequency_weeks, weigh_in_weekday FROM goals WHERE user_id = ?",
      args: [u.id],
    }),
    db.execute({
      sql: "SELECT current_streak, last_completed_date, best_streak FROM water_streak WHERE user_id = ?",
      args: [u.id],
    }),
    db.execute({
      sql: "SELECT COALESCE(SUM(steps), 0) as steps FROM steps_logs WHERE user_id = ? AND logged_at >= ? AND logged_at < ?",
      args: [u.id, startUtc, endUtc],
    }),
    db.execute({
      sql: `SELECT
              COALESCE((
                SELECT ROUND(SUM(mi.quantity * f.calories / 100.0))
                FROM meals m
                JOIN meal_items mi ON mi.meal_id = m.id
                JOIN foods f ON f.id = mi.food_id
                WHERE m.user_id = ? AND m.logged_at >= ? AND m.logged_at < ?
              ), 0)
              +
              COALESCE((
                SELECT ROUND(SUM(total_calories))
                FROM ai_meal_logs
                WHERE user_id = ? AND logged_at >= ? AND logged_at < ?
              ), 0) AS total_calories`,
      args: [u.id, startUtc, endUtc, u.id, startUtc, endUtc],
    }),
    db.execute({
      sql: "SELECT COALESCE(SUM(steps), 0) as total_steps FROM steps_logs WHERE user_id = ?",
      args: [u.id],
    }),
    db.execute({
      sql: "SELECT created_at FROM users WHERE id = ?",
      args: [u.id],
    }),
    db.execute({
      sql: `SELECT daily_calories_target
            FROM menu_plans
            WHERE client_id = ? AND status = 'published' AND daily_calories_target IS NOT NULL
            ORDER BY updated_at DESC, created_at DESC
            LIMIT 1`,
      args: [u.id],
    }),
  ]);

  const quotes = (quotesRes.rows as unknown as { text: string }[]).map((r) => r.text).filter(Boolean);
  const waterLogs = waterRes.rows as unknown as { amount_ml: number }[];
  const waterTotal = waterLogs.reduce((s, l) => s + l.amount_ml, 0);
  const waterGoal = (goalsRes.rows[0]?.daily_water_ml as number) || 2000;
  const generalCalorieGoal = goalsRes.rows[0]?.daily_calories == null
    ? null
    : Number(goalsRes.rows[0].daily_calories);
  const menuCalorieGoal = publishedMenuRes.rows[0]?.daily_calories_target == null
    ? null
    : Number(publishedMenuRes.rows[0].daily_calories_target);
  const calGoal = menuCalorieGoal ?? generalCalorieGoal;
  const calorieGoalSource = menuCalorieGoal !== null
    ? "menu"
    : generalCalorieGoal !== null
      ? "general"
      : null;
  const goalsRow = goalsRes.rows[0] || null;
  const streakRow = streakRes.rows[0] || {};
  const profileRow = profileRes.rows[0] || {};
  const createdAt = profileRow.created_at ? String(profileRow.created_at) : null;
  const daysSinceSignup = createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(`${createdAt.replace(" ", "T")}Z`).getTime()) / 86400000))
    : 0;

  return NextResponse.json(
    {
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
      calorie_goal_source: calorieGoalSource,
      protein_goal: (goalsRes.rows[0]?.daily_protein_g as number) || null,
      weigh_in_frequency_weeks: (goalsRes.rows[0]?.weigh_in_frequency_weeks as number) || null,
      weigh_in_weekday: goalsRes.rows[0]?.weigh_in_weekday == null ? null : Number(goalsRes.rows[0].weigh_in_weekday),
      goal_status: {
        target_weight: goalsRow?.target_weight_kg != null,
        calories: calGoal !== null,
        protein: goalsRow?.daily_protein_g != null,
        water: goalsRow?.daily_water_ml != null,
        steps: goalsRow?.daily_steps != null,
      },
    },
    // "Today" changes under this same URL at the Jerusalem midnight boundary —
    // an intermediate cache (browser or proxy) holding a pre-midnight response
    // would keep serving yesterday's totals labeled as today's.
    { headers: { "Cache-Control": "no-store" } }
  );
}
