import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();
  const { itemId } = await params;
  const owned = await db.execute({
    sql: `SELECT mi.id, mp.id AS plan_id FROM menu_items mi
          JOIN menu_meal_options mo ON mo.id = mi.menu_meal_option_id
          JOIN menu_meals mm ON mm.id = mo.menu_meal_id
          JOIN menu_days md ON md.id = mm.menu_day_id
          JOIN menu_plans mp ON mp.id = md.menu_plan_id
          JOIN users u ON u.id = mp.client_id
          WHERE mi.id = ? AND mp.coach_id = ? AND u.coach_id = ? AND u.role = 'client'`,
    args: [itemId, coach.id, coach.id],
  });
  const row = owned.rows[0];
  if (!row) return NextResponse.json({ error: "הפריט לא נמצא" }, { status: 404 });
  await db.batch([
    { sql: "DELETE FROM menu_items WHERE id = ?", args: [itemId] },
    { sql: "UPDATE menu_plans SET updated_at = datetime('now') WHERE id = ?", args: [row.plan_id] },
  ], "write");
  return NextResponse.json({ ok: true });
}
