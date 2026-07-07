import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ optionId: string }> }) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();
  const { optionId } = await params;

  const ownership = await db.execute({
    sql: `SELECT mo.menu_meal_id, mp.id AS plan_id FROM menu_meal_options mo
          JOIN menu_meals mm ON mm.id = mo.menu_meal_id
          JOIN menu_days md ON md.id = mm.menu_day_id
          JOIN menu_plans mp ON mp.id = md.menu_plan_id
          JOIN users u ON u.id = mp.client_id
          WHERE mo.id = ? AND mp.coach_id = ? AND u.coach_id = ? AND u.role = 'client'`,
    args: [optionId, coach.id, coach.id],
  });
  const row = ownership.rows[0];
  if (!row) return NextResponse.json({ error: "האפשרות לא נמצאה" }, { status: 404 });

  const countResult = await db.execute({
    sql: "SELECT COUNT(*) AS c FROM menu_meal_options WHERE menu_meal_id = ?",
    args: [row.menu_meal_id],
  });
  if (Number(countResult.rows[0]?.c ?? 0) <= 1) {
    return NextResponse.json({ error: "חייבת להישאר לפחות אפשרות אחת בארוחה" }, { status: 400 });
  }

  await db.batch([
    { sql: "UPDATE menu_meals SET selected_option_id = NULL, selected_at = NULL WHERE id = ? AND selected_option_id = ?", args: [row.menu_meal_id, optionId] },
    { sql: "DELETE FROM menu_meal_options WHERE id = ?", args: [optionId] },
    { sql: "UPDATE menu_plans SET updated_at = datetime('now') WHERE id = ?", args: [row.plan_id] },
  ], "write");

  return NextResponse.json({ ok: true });
}
