import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

export async function GET() {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  await initDb();

  const mealsRes = await db.execute({
    sql: `SELECT
            aml.id,
            aml.total_calories,
            aml.ai_response,
            aml.photo_url,
            aml.logged_at,
            u.name AS client_name
          FROM ai_meal_logs aml
          JOIN users u ON aml.user_id = u.id
          WHERE u.coach_id = ?
          AND aml.logged_at >= datetime('now', '-35 days')
          ORDER BY aml.logged_at DESC
          LIMIT 300`,
    args: [coach.id],
  });

  const meals = mealsRes.rows.map((r) => ({
    id: r.id as string,
    total_calories: r.total_calories as number,
    logged_at: r.logged_at as string,
    photo_url: r.photo_url as string,
    client_name: r.client_name as string,
    items: (() => {
      try {
        return JSON.parse(r.ai_response as string).items ?? [];
      } catch {
        return [];
      }
    })(),
  }));

  return NextResponse.json(meals);
}
