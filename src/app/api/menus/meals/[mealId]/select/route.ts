import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { getTodayDayKey } from "@/lib/daily-summary";
import { isMarkableDayKey } from "@/lib/menu-week";

// Client records what they actually ate for a planned meal, on a specific date:
//   { dayKey, optionId }          -> ate that option from the plan
//   { dayKey, status: "other" }   -> ate something else
//   { dayKey, optionId: null }    -> clear the mark
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ mealId: string }> }) {
  const client = await getSessionUser();
  if (!client || client.role !== "client") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();
  const { mealId } = await params;
  const body = await req.json();

  const dayKey = typeof body?.dayKey === "string" ? body.dayKey : getTodayDayKey();
  if (!isMarkableDayKey(dayKey)) {
    return NextResponse.json({ error: "אפשר לסמן רק ימים שכבר עברו בשבוע הנוכחי" }, { status: 400 });
  }

  const ateSomethingElse = body?.status === "other";
  const optionId = ateSomethingElse
    ? null
    : body?.optionId === null
      ? null
      : typeof body?.optionId === "string"
        ? body.optionId
        : undefined;
  if (optionId === undefined) return NextResponse.json({ error: "חסר optionId" }, { status: 400 });

  const owned = await db.execute({
    sql: `SELECT mm.id FROM menu_meals mm
          JOIN menu_days md ON md.id = mm.menu_day_id
          JOIN menu_plans mp ON mp.id = md.menu_plan_id
          WHERE mm.id = ? AND mp.client_id = ? AND mp.status = 'published'`,
    args: [mealId, client.id],
  });
  if (owned.rows.length === 0) return NextResponse.json({ error: "הארוחה לא נמצאה" }, { status: 404 });

  if (optionId !== null) {
    const optionOwned = await db.execute({
      sql: "SELECT id FROM menu_meal_options WHERE id = ? AND menu_meal_id = ?",
      args: [optionId, mealId],
    });
    if (optionOwned.rows.length === 0) return NextResponse.json({ error: "האפשרות לא נמצאה" }, { status: 404 });
  }

  // Clearing the mark = no row at all, so an unmarked day stays distinguishable
  // from a day the client explicitly reported as off-plan.
  if (!ateSomethingElse && optionId === null) {
    await db.execute({
      sql: "DELETE FROM menu_meal_selections WHERE menu_meal_id = ? AND day_key = ?",
      args: [mealId, dayKey],
    });
    return NextResponse.json({ menu_meal_id: mealId, day_key: dayKey, option_id: null, status: null });
  }

  const status = ateSomethingElse ? "other" : "planned";
  await db.execute({
    sql: `INSERT INTO menu_meal_selections (menu_meal_id, day_key, option_id, status, selected_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(menu_meal_id, day_key) DO UPDATE SET
            option_id = excluded.option_id,
            status = excluded.status,
            selected_at = excluded.selected_at`,
    args: [mealId, dayKey, optionId, status],
  });

  return NextResponse.json({ menu_meal_id: mealId, day_key: dayKey, option_id: optionId, status });
}
