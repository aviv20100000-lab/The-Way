import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

type MealItem = Record<string, unknown>;

function parseItems(value: unknown): MealItem[] {
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  await initDb();

  const requestedClientId = req.nextUrl.searchParams.get("clientId")?.trim() || null;
  const requestedDays = Number(req.nextUrl.searchParams.get("days") || 35);
  const days = [7, 35, 90].includes(requestedDays) ? requestedDays : 35;
  const since = `-${days} days`;
  const clientClause = requestedClientId ? "AND u.id = ?" : "";
  const args = requestedClientId ? [coach.id, since, requestedClientId] : [coach.id, since];

  const [aiRes, quickRes] = await Promise.all([
    db.execute({
      sql: `SELECT
              aml.id,
              aml.user_id AS client_id,
              aml.total_calories,
              aml.ai_response,
              aml.photo_url,
              strftime('%Y-%m-%dT%H:%M:%SZ', aml.logged_at) AS logged_at,
              u.name AS client_name,
              u.avatar_url AS client_avatar_url
            FROM ai_meal_logs aml
            JOIN users u ON aml.user_id = u.id
            WHERE u.role = 'client'
              AND u.coach_id = ?
              AND aml.logged_at >= datetime('now', ?)
              ${clientClause}
            ORDER BY aml.logged_at DESC
            LIMIT 1000`,
      args,
    }),
    db.execute({
      sql: `SELECT
              m.id,
              m.user_id AS client_id,
              strftime('%Y-%m-%dT%H:%M:%SZ', m.logged_at) AS logged_at,
              u.name AS client_name,
              u.avatar_url AS client_avatar_url,
              ROUND(SUM(mi.quantity * f.calories / 100.0)) AS total_calories,
              GROUP_CONCAT(
                f.name_he || ':' || ROUND(mi.quantity * f.calories / 100.0) || ':' ||
                mi.quantity || ':' || ROUND(mi.quantity * f.protein / 100.0, 1),
                '|'
              ) AS items_raw
            FROM meals m
            JOIN meal_items mi ON mi.meal_id = m.id
            JOIN foods f ON f.id = mi.food_id
            JOIN users u ON m.user_id = u.id
            WHERE u.role = 'client'
              AND u.coach_id = ?
              AND m.logged_at >= datetime('now', ?)
              ${clientClause}
            GROUP BY m.id, m.user_id, m.logged_at, u.name, u.avatar_url
            ORDER BY m.logged_at DESC
            LIMIT 1000`,
      args,
    }),
  ]);

  const aiMeals = aiRes.rows.map((row) => ({
    id: String(row.id),
    client_id: String(row.client_id),
    client_name: String(row.client_name),
    client_avatar_url: row.client_avatar_url ? String(row.client_avatar_url) : null,
    total_calories: Number(row.total_calories) || 0,
    logged_at: String(row.logged_at),
    photo_url: row.photo_url ? String(row.photo_url) : null,
    source: "ai" as const,
    items: parseItems(row.ai_response),
  }));

  const quickMeals = quickRes.rows.map((row) => ({
    id: String(row.id),
    client_id: String(row.client_id),
    client_name: String(row.client_name),
    client_avatar_url: row.client_avatar_url ? String(row.client_avatar_url) : null,
    total_calories: Math.round(Number(row.total_calories) || 0),
    logged_at: String(row.logged_at),
    photo_url: null,
    source: "quick" as const,
    items: String(row.items_raw || "")
      .split("|")
      .filter(Boolean)
      .map((segment) => {
        const [name, calories, grams, protein] = segment.split(":");
        return {
          name: name || "פריט",
          calories: Math.round(Number(calories) || 0),
          estimated_weight_g: Math.round(Number(grams) || 0),
          protein_g: Number(protein) || 0,
        };
      }),
  }));

  return NextResponse.json(
    [...aiMeals, ...quickMeals].sort(
      (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
    )
  );
}
