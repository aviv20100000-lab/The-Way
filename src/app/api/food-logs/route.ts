import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { ensureSeed } from "@/lib/seed";

export async function GET() {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session || session.role !== "coach") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const res = await db.execute({
    sql: `SELECT m.id, m.user_id, m.photo_url, m.ai_response, m.total_calories, m.logged_at, u.name as client_name
          FROM ai_meal_logs m
          JOIN users u ON u.id = m.user_id
          WHERE u.coach_id = ?
            AND m.logged_at >= datetime('now', '-7 days')
          ORDER BY m.logged_at DESC`,
    args: [session.id],
  });

  const logs = res.rows.map((r) => ({
    id: r.id as string,
    client_name: r.client_name as string,
    photo_url: r.photo_url as string,
    total_calories: r.total_calories as number,
    logged_at: r.logged_at as string,
    items: (() => {
      try {
        const parsed = JSON.parse(r.ai_response as string);
        return parsed.items ?? [];
      } catch { return []; }
    })(),
  }));

  return NextResponse.json(logs);
}
