import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

type ActivityKind = "meal" | "quick_meal" | "weight" | "steps" | "menu_request" | "goals_request";

function activityText(kind: ActivityKind, value: number) {
  switch (kind) {
    case "meal": return { title: "העלה ארוחה", detail: `${Math.round(value)} קלוריות` };
    case "quick_meal": return { title: "רשם ארוחה מהירה", detail: `${Math.round(value)} קלוריות` };
    case "weight": return { title: "עדכן משקל", detail: `${value.toFixed(1)} ק״ג` };
    case "steps": return { title: "העלה צעדים", detail: `${Math.round(value).toLocaleString("he-IL")} צעדים` };
    case "menu_request": return { title: "מבקש תפריט", detail: "המתאמן הזכיר להעלות תפריט" };
    case "goals_request": return { title: "מבקש עדכון יעדים", detail: "קלוריות, חלבון או יעד משקל" };
  }
}

export async function GET() {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  await initDb();

  const [activityRes, readsRes] = await Promise.all([
    db.execute({
      sql: `SELECT activity_id, client_id, client_name, kind, value, logged_at
            FROM (
              SELECT 'ai:' || aml.id AS activity_id, u.id AS client_id, u.name AS client_name,
                     'meal' AS kind, COALESCE(aml.total_calories, 0) AS value, aml.logged_at
              FROM ai_meal_logs aml
              JOIN users u ON u.id = aml.user_id
              WHERE u.role = 'client' AND u.coach_id = ?
                AND aml.logged_at >= datetime('now', '-30 days')

              UNION ALL

              SELECT 'quick:' || m.id AS activity_id, u.id AS client_id, u.name AS client_name,
                     'quick_meal' AS kind,
                     COALESCE((SELECT ROUND(SUM(mi.quantity * f.calories / 100.0))
                               FROM meal_items mi JOIN foods f ON f.id = mi.food_id
                               WHERE mi.meal_id = m.id), 0) AS value,
                     m.logged_at
              FROM meals m
              JOIN users u ON u.id = m.user_id
              WHERE u.role = 'client' AND u.coach_id = ?
                AND m.logged_at >= datetime('now', '-30 days')

              UNION ALL

              SELECT 'weight:' || wl.id AS activity_id, u.id AS client_id, u.name AS client_name,
                     'weight' AS kind, wl.weight_kg AS value, wl.logged_at
              FROM weight_logs wl
              JOIN users u ON u.id = wl.user_id
              WHERE u.role = 'client' AND u.coach_id = ?
                AND wl.logged_at >= datetime('now', '-30 days')

              UNION ALL

              SELECT 'steps:' || sl.id AS activity_id, u.id AS client_id, u.name AS client_name,
                     'steps' AS kind, sl.steps AS value, sl.logged_at
              FROM steps_logs sl
              JOIN users u ON u.id = sl.user_id
              WHERE u.role = 'client' AND u.coach_id = ?
                AND sl.logged_at >= datetime('now', '-30 days')

              UNION ALL

              SELECT 'request:' || cr.id AS activity_id, u.id AS client_id, u.name AS client_name,
                     CASE cr.kind WHEN 'menu' THEN 'menu_request' ELSE 'goals_request' END AS kind,
                     0 AS value, cr.created_at AS logged_at
              FROM coach_requests cr
              JOIN users u ON u.id = cr.client_id
              WHERE cr.coach_id = ?
                AND cr.created_at >= datetime('now', '-30 days')
            ) activity
            ORDER BY logged_at DESC`,
      args: [coach.id, coach.id, coach.id, coach.id, coach.id],
    }),
    db.execute({
      sql: "SELECT activity_id FROM coach_activity_reads WHERE coach_id = ?",
      args: [coach.id],
    }),
  ]);

  const readIds = new Set(readsRes.rows.map((row) => String(row.activity_id)));
  const allItems = activityRes.rows.map((row) => {
    const kind = String(row.kind) as ActivityKind;
    const value = Number(row.value) || 0;
    const text = activityText(kind, value);
    return {
      id: String(row.activity_id),
      client_id: String(row.client_id),
      client_name: String(row.client_name),
      kind,
      ...text,
      logged_at: `${String(row.logged_at).replace(" ", "T")}Z`,
      unread: !readIds.has(String(row.activity_id)),
    };
  });
  allItems.sort((a, b) => Number(b.unread) - Number(a.unread) || b.logged_at.localeCompare(a.logged_at));

  return NextResponse.json({
    items: allItems.slice(0, 50),
    unread_count: allItems.filter((item) => item.unread).length,
  });
}

export async function POST(req: NextRequest) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  await initDb();
  const body = await req.json().catch(() => ({}));
  const activityIds = Array.isArray(body.activityIds)
    ? [...new Set(body.activityIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 100))].slice(0, 50)
    : [];
  if (activityIds.length === 0) return NextResponse.json({ ok: true, marked: 0 });

  await db.batch(activityIds.map((activityId) => ({
    sql: `INSERT INTO coach_activity_reads (coach_id, activity_id, read_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(coach_id, activity_id) DO UPDATE SET read_at = datetime('now')`,
    args: [coach.id, activityId],
  })), "write");

  return NextResponse.json({ ok: true, marked: activityIds.length });
}
