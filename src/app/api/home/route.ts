import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { formatDayKey, getDayRangeUtc, getTodayDayKey } from "@/lib/daily-summary";

function shiftDayKey(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// Combined home endpoint — replaces 4 separate API calls with 1
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const u = user as { id: string; coach_id?: string; role: string };
  const today = new Date().toISOString().split("T")[0];
  const jerusalemToday = getTodayDayKey();
  const { startUtc: activityStartUtc } = getDayRangeUtc(shiftDayKey(jerusalemToday, -59));
  const { startUtc: activityEndUtc } = getDayRangeUtc(shiftDayKey(jerusalemToday, 1));

  // All DB queries in parallel — single session lookup, single initDb
  const [quotesRes, waterRes, goalsRes, streakRes, stepsRes, caloriesRes, activityDaysRes] = await Promise.all([
    db.execute("SELECT text FROM quotes WHERE active = 1"),
    db.execute({
      sql: "SELECT amount_ml FROM water_logs WHERE user_id = ? AND DATE(logged_at) = ?",
      args: [u.id, today],
    }),
    db.execute({
      sql: "SELECT daily_water_ml, daily_calories, daily_protein_g, daily_steps FROM goals WHERE user_id = ?",
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
      sql: `SELECT logged_at FROM ai_meal_logs
            WHERE user_id = ? AND logged_at >= ? AND logged_at < ?
            UNION
            SELECT logged_at FROM meals
            WHERE user_id = ? AND logged_at >= ? AND logged_at < ?
            UNION
            SELECT logged_at FROM water_logs
            WHERE user_id = ? AND logged_at >= ? AND logged_at < ?
            UNION
            SELECT logged_at FROM steps_logs
            WHERE user_id = ? AND logged_at >= ? AND logged_at < ?
            UNION
            SELECT logged_at FROM weight_logs
            WHERE user_id = ? AND logged_at >= ? AND logged_at < ?`,
      args: [
        u.id, activityStartUtc, activityEndUtc,
        u.id, activityStartUtc, activityEndUtc,
        u.id, activityStartUtc, activityEndUtc,
        u.id, activityStartUtc, activityEndUtc,
        u.id, activityStartUtc, activityEndUtc,
      ],
    }),
  ]);

  const quotes = (quotesRes.rows as unknown as { text: string }[]).map((r) => r.text).filter(Boolean);
  const waterLogs = waterRes.rows as unknown as { amount_ml: number }[];
  const waterTotal = waterLogs.reduce((s, l) => s + l.amount_ml, 0);
  const waterGoal = (goalsRes.rows[0]?.daily_water_ml as number) || 2000;
  const calGoal = (goalsRes.rows[0]?.daily_calories as number) || null;
  const streakRow = streakRes.rows[0] || {};
  const activityDays = new Set<string>();

  for (const row of activityDaysRes.rows) {
    const loggedAt = String(row.logged_at ?? "");
    const loggedAtUtc = new Date(`${loggedAt.replace(" ", "T")}Z`);
    if (!Number.isNaN(loggedAtUtc.getTime())) {
      activityDays.add(formatDayKey(loggedAtUtc));
    }
  }

  let streak = 0;
  let streakDay = activityDays.has(jerusalemToday)
    ? jerusalemToday
    : shiftDayKey(jerusalemToday, -1);

  while (activityDays.has(streakDay)) {
    streak += 1;
    streakDay = shiftDayKey(streakDay, -1);
  }

  return NextResponse.json({
    quotes,
    streak,
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
  });
}
