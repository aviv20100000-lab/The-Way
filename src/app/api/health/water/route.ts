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

  const now = new Date().toISOString();

  // Update streak: check if goal reached after this addition
  const today = now.slice(0, 10);
  const [goalRes, totalRes] = await Promise.all([
    db.execute({ sql: "SELECT daily_water_ml FROM goals WHERE user_id = ?", args: [user.id] }),
    db.execute({
      sql: "SELECT COALESCE(SUM(amount_ml), 0) as total FROM water_logs WHERE user_id = ? AND DATE(logged_at) = ?",
      args: [user.id, today],
    }),
  ]);
  const goal = (goalRes.rows[0]?.daily_water_ml as number) || 2000;
  const total = (totalRes.rows[0]?.total as number) || 0;

  if (total >= goal) {
    const streakRes = await db.execute({
      sql: "SELECT current_streak, last_completed_date, best_streak FROM water_streak WHERE user_id = ?",
      args: [user.id],
    });
    const row = streakRes.rows[0];
    const lastDate = row?.last_completed_date as string | null;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (lastDate !== today) {
      const newStreak = lastDate === yesterday ? ((row?.current_streak as number) || 0) + 1 : 1;
      const bestStreak = Math.max(newStreak, (row?.best_streak as number) || 0);
      await db.execute({
        sql: `INSERT INTO water_streak (user_id, current_streak, last_completed_date, best_streak, updated_at)
              VALUES (?, ?, ?, ?, datetime('now'))
              ON CONFLICT(user_id) DO UPDATE SET
                current_streak = excluded.current_streak,
                last_completed_date = excluded.last_completed_date,
                best_streak = excluded.best_streak,
                updated_at = excluded.updated_at`,
        args: [user.id, newStreak, today, bestStreak],
      });
    }
  }

  return NextResponse.json({ id: logId, amount_ml, logged_at: now });
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const today = new Date().toISOString().split("T")[0];

  // Run all 3 queries in parallel
  const [logsRes, goalRes, streakRes] = await Promise.all([
    db.execute({
      sql: `SELECT * FROM water_logs
            WHERE user_id = ? AND DATE(logged_at) = ?
            ORDER BY logged_at DESC`,
      args: [user.id, today],
    }),
    db.execute({
      sql: "SELECT daily_water_ml FROM goals WHERE user_id = ?",
      args: [user.id],
    }),
    db.execute({
      sql: "SELECT current_streak, last_completed_date, best_streak FROM water_streak WHERE user_id = ?",
      args: [user.id],
    }),
  ]);

  const total = (logsRes.rows as unknown as Array<{ amount_ml: number }>).reduce((sum, log) => sum + log.amount_ml, 0);
  const goal = (goalRes.rows[0]?.daily_water_ml as number) || 2000;
  const streakRow = streakRes.rows[0] || { current_streak: 0, last_completed_date: null, best_streak: 0 };

  return NextResponse.json({
    logs: logsRes.rows,
    total,
    goal,
    streak: {
      current_streak: streakRow.current_streak ?? 0,
      last_completed_date: streakRow.last_completed_date ?? null,
      best_streak: streakRow.best_streak ?? 0,
      goal_reached_today: total >= goal,
    },
  });
}
