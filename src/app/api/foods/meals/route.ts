import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import db, { initDb } from "@/lib/db";
import { getDayRangeUtc, getTodayDayKey } from "@/lib/daily-summary";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const { startUtc, endUtc } = getDayRangeUtc(getTodayDayKey());

  const [aiRes, quickRes, goalRes] = await Promise.all([
    db.execute({
      sql: `SELECT id, total_calories, ai_response, logged_at FROM ai_meal_logs
            WHERE user_id = ? AND logged_at >= datetime('now', '-35 days')
            ORDER BY logged_at DESC LIMIT 300`,
      args: [user.id],
    }),
    db.execute({
      sql: `SELECT m.id, m.logged_at,
              ROUND(SUM(mi.quantity * f.calories / 100.0)) as total_calories,
              GROUP_CONCAT(f.name_he || ':' || ROUND(mi.quantity * f.calories / 100.0) || ':' || mi.quantity, '|') as items_raw
            FROM meals m
            JOIN meal_items mi ON mi.meal_id = m.id
            JOIN foods f ON f.id = mi.food_id
            WHERE m.user_id = ? AND m.logged_at >= datetime('now', '-35 days')
            GROUP BY m.id
            ORDER BY m.logged_at DESC LIMIT 300`,
      args: [user.id],
    }),
    db.execute({
      sql: "SELECT daily_calories, daily_protein_g FROM goals WHERE user_id = ?",
      args: [user.id],
    }),
  ]);

  const aiMeals = aiRes.rows.map((r) => ({
    id: r.id as string,
    total_calories: r.total_calories as number,
    logged_at: r.logged_at as string,
    source: "ai" as const,
    items: (() => {
      try { return JSON.parse(r.ai_response as string).items ?? []; } catch { return []; }
    })(),
  }));

  const quickMeals = quickRes.rows.map((r) => ({
    id: r.id as string,
    total_calories: Math.round((r.total_calories as number) || 0),
    logged_at: r.logged_at as string,
    source: "quick" as const,
    items: String(r.items_raw || "").split("|").filter(Boolean).map((seg) => {
      const [name, cal, grams] = seg.split(":");
      return { name: name ?? "", calories: Math.round(Number(cal) || 0), estimated_weight_g: Math.round(Number(grams) || 0) };
    }),
  }));

  const meals = [...aiMeals, ...quickMeals].sort(
    (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
  );

  const todayCalories = meals
    .filter((m) => m.logged_at >= startUtc && m.logged_at < endUtc)
    .reduce((s, m) => s + (m.total_calories || 0), 0);

  return NextResponse.json({
    meals,
    today_calories: todayCalories,
    goal_calories: (goalRes.rows[0]?.daily_calories as number) ?? null,
    goal_protein_g: (goalRes.rows[0]?.daily_protein_g as number) ?? null,
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (user.role !== "client") return NextResponse.json({ error: "רק מתאמנים יכולים לרשום ארוחות" }, { status: 403 });

  await initDb();

  try {
    const body = await req.json();
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (rawItems.length === 0 || rawItems.length > 30) {
      return NextResponse.json({ error: "אין פריטים לשמירה" }, { status: 400 });
    }

    const items: Array<Record<string, unknown> & { name: string; calories: number; estimated_weight_g: number }> = rawItems.map((item: Record<string, unknown>) => ({
      ...item,
      name: String(item.name || "").trim().slice(0, 120),
      calories: Math.round(Number(item.calories) || 0),
      estimated_weight_g: Math.round(Number(item.estimated_weight_g) || 0),
    }));
    if (items.some((item: { name: string; calories: number; estimated_weight_g: number }) => !item.name || item.calories < 0 || item.calories > 10000 || item.estimated_weight_g < 0 || item.estimated_weight_g > 10000)) {
      return NextResponse.json({ error: "אחד מפריטי הארוחה אינו תקין" }, { status: 400 });
    }
    const total = items.reduce((sum: number, item: { calories: number }) => sum + item.calories, 0);

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
    return NextResponse.json({ error: "אירעה שגיאה בשמירת הארוחה. נסה שוב מאוחר יותר." }, { status: 500 });
  }
}
