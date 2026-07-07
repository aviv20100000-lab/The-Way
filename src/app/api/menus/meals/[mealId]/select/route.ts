import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

// Client picks which option they actually ate for this meal (or clears the pick).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ mealId: string }> }) {
  const client = await getSessionUser();
  if (!client || client.role !== "client") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();
  const { mealId } = await params;
  const body = await req.json();
  const optionId = body?.optionId === null ? null : typeof body?.optionId === "string" ? body.optionId : undefined;
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

  await db.execute({
    sql: "UPDATE menu_meals SET selected_option_id = ?, selected_at = CASE WHEN ? IS NULL THEN NULL ELSE datetime('now') END WHERE id = ?",
    args: [optionId, optionId, mealId],
  });
  return NextResponse.json({ id: mealId, selected_option_id: optionId, selected_at: optionId ? new Date().toISOString() : null });
}
