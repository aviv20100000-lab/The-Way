import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const coachId = user.role === "coach" ? user.id : user.coach_id;
  if (!coachId) return NextResponse.json([]);

  const [todayRes, weekRes] = await Promise.all([
    db.execute({
      sql: `SELECT u.id, u.name,
              COALESCE(ROUND(SUM(mi.quantity * f.calories / 100.0)), 0) AS calories
            FROM users u
            LEFT JOIN meals m ON m.user_id = u.id AND DATE(m.logged_at) = DATE('now')
            LEFT JOIN meal_items mi ON mi.meal_id = m.id
            LEFT JOIN foods f ON f.id = mi.food_id
            WHERE u.coach_id = ?
            GROUP BY u.id
            ORDER BY calories DESC`,
      args: [coachId],
    }),
    db.execute({
      sql: `SELECT u.id, u.name,
              COALESCE(ROUND(SUM(mi.quantity * f.calories / 100.0)), 0) AS calories
            FROM users u
            LEFT JOIN meals m ON m.user_id = u.id AND m.logged_at >= datetime('now', '-7 days')
            LEFT JOIN meal_items mi ON mi.meal_id = m.id
            LEFT JOIN foods f ON f.id = mi.food_id
            WHERE u.coach_id = ?
            GROUP BY u.id
            ORDER BY calories DESC`,
      args: [coachId],
    }),
  ]);

  const todayMap = new Map(
    (todayRes.rows as unknown as Array<{ id: string; name: string; calories: number }>)
      .map((r) => [r.id, r.calories])
  );
  const weekMap = new Map(
    (weekRes.rows as unknown as Array<{ id: string; name: string; calories: number }>)
      .map((r) => [r.id, r.calories])
  );

  const ids = new Set([...todayMap.keys(), ...weekMap.keys()]);
  const names = new Map(
    [
      ...(todayRes.rows as unknown as Array<{ id: string; name: string }>),
      ...(weekRes.rows as unknown as Array<{ id: string; name: string }>),
    ].map((r) => [r.id, r.name])
  );

  const leaderboard = Array.from(ids).map((id) => ({
    id,
    name: names.get(id) ?? "",
    today: todayMap.get(id) ?? 0,
    week: weekMap.get(id) ?? 0,
  }));

  return NextResponse.json(leaderboard);
}
