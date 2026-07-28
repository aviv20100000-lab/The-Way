import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

const MAX_DAYS = 180;
const DEFAULT_DAYS = 30;

// GET /api/admin/scan-corrections?days=30
// Coach-only. Answers "where is the food scan actually wrong?" from what trainees
// corrected, rather than from guesswork about the prompt.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "coach") {
    return NextResponse.json({ error: "ללא הרשאה" }, { status: 401 });
  }

  await initDb();

  const daysParam = parseInt(req.nextUrl.searchParams.get("days") ?? String(DEFAULT_DAYS), 10);
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, MAX_DAYS) : DEFAULT_DAYS;
  const since = `-${days} days`;

  // Scoped to this coach's own trainees — a coach must not see another's data.
  const [summaryRes, worstNamesRes, missedRes, portionRes] = await Promise.all([
    db.execute({
      sql: `SELECT sc.kind, COUNT(*) AS total
            FROM scan_corrections sc
            JOIN users u ON u.id = sc.user_id
            WHERE u.coach_id = ? AND sc.created_at >= datetime('now', ?)
            GROUP BY sc.kind`,
      args: [user.id, since],
    }),
    // Foods the scan names and the trainee then changes or deletes.
    db.execute({
      sql: `SELECT sc.ai_name AS name, COUNT(*) AS total
            FROM scan_corrections sc
            JOIN users u ON u.id = sc.user_id
            WHERE u.coach_id = ? AND sc.created_at >= datetime('now', ?)
              AND sc.kind IN ('renamed', 'removed') AND sc.ai_name IS NOT NULL AND sc.ai_name <> ''
            GROUP BY sc.ai_name
            ORDER BY total DESC, name ASC
            LIMIT 15`,
      args: [user.id, since],
    }),
    // Foods trainees add themselves — things the scan never saw.
    db.execute({
      sql: `SELECT sc.final_name AS name, COUNT(*) AS total
            FROM scan_corrections sc
            JOIN users u ON u.id = sc.user_id
            WHERE u.coach_id = ? AND sc.created_at >= datetime('now', ?)
              AND sc.kind = 'added' AND sc.final_name IS NOT NULL AND sc.final_name <> ''
            GROUP BY sc.final_name
            ORDER BY total DESC, name ASC
            LIMIT 15`,
      args: [user.id, since],
    }),
    // Portion drift: is the scan systematically over- or under-estimating?
    db.execute({
      sql: `SELECT sc.ai_name AS name, COUNT(*) AS total,
                   ROUND(AVG(sc.final_grams - sc.ai_grams)) AS avg_grams_delta,
                   ROUND(AVG(sc.final_calories - sc.ai_calories)) AS avg_calories_delta
            FROM scan_corrections sc
            JOIN users u ON u.id = sc.user_id
            WHERE u.coach_id = ? AND sc.created_at >= datetime('now', ?)
              AND sc.kind = 'edited' AND sc.ai_grams IS NOT NULL AND sc.final_grams IS NOT NULL
            GROUP BY sc.ai_name
            ORDER BY total DESC
            LIMIT 15`,
      args: [user.id, since],
    }),
  ]);

  const summary = { renamed: 0, edited: 0, added: 0, removed: 0 } as Record<string, number>;
  for (const row of summaryRes.rows) summary[String(row.kind)] = Number(row.total) || 0;

  return NextResponse.json(
    {
      days,
      summary,
      total: Object.values(summary).reduce((sum, value) => sum + value, 0),
      misidentified: worstNamesRes.rows.map((row) => ({ name: String(row.name), total: Number(row.total) })),
      missed: missedRes.rows.map((row) => ({ name: String(row.name), total: Number(row.total) })),
      portion_drift: portionRes.rows.map((row) => ({
        name: String(row.name),
        total: Number(row.total),
        avg_grams_delta: Number(row.avg_grams_delta) || 0,
        avg_calories_delta: Number(row.avg_calories_delta) || 0,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
