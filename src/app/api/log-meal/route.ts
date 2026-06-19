import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import db, { initDb } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const today = new Date().toISOString().split("T")[0];

  const [mealsRes, goalRes] = await Promise.all([
    db.execute({
      sql: `SELECT id, total_calories, ai_response, logged_at FROM ai_meal_logs
            WHERE user_id = ? AND logged_at >= datetime('now', '-35 days')
            ORDER BY logged_at DESC LIMIT 300`,
      args: [user.id],
    }),
    db.execute({
      sql: "SELECT daily_calories FROM goals WHERE user_id = ?",
      args: [user.id],
    }),
  ]);

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

  const todayCalories = meals
    .filter((m) => m.logged_at.slice(0, 10) === today)
    .reduce((s, m) => s + (m.total_calories || 0), 0);

  return NextResponse.json({
    meals,
    today_calories: todayCalories,
    goal_calories: (goalRes.rows[0]?.daily_calories as number) ?? null,
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();

  try {
    const body = await req.json();
    const items = Array.isArray(body.items) ? body.items : [];
    const total = Math.round(Number(body.total_calories) || 0);

    if (items.length === 0) {
      return NextResponse.json({ error: "אין פריטים לשמירה" }, { status: 400 });
    }

    const id = uuid();
    await db.execute({
      sql: `INSERT INTO ai_meal_logs (id, user_id, photo_url, ai_response, total_calories, logged_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [id, user.id, "", JSON.stringify({ items }), total],
    });

    return NextResponse.json({ id });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("log-meal error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
