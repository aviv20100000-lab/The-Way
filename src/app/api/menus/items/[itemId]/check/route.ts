import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const client = await getSessionUser();
  if (!client || client.role !== "client") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();
  const { itemId } = await params;
  const body = await req.json();
  if (typeof body?.checked !== "boolean") return NextResponse.json({ error: "מצב הסימון אינו תקין" }, { status: 400 });

  const owned = await db.execute({
    sql: `SELECT mi.id FROM menu_items mi
          JOIN menu_meals mm ON mm.id = mi.menu_meal_id
          JOIN menu_days md ON md.id = mm.menu_day_id
          JOIN menu_plans mp ON mp.id = md.menu_plan_id
          WHERE mi.id = ? AND mp.client_id = ? AND mp.status = 'published'`,
    args: [itemId, client.id],
  });
  if (owned.rows.length === 0) return NextResponse.json({ error: "הפריט לא נמצא" }, { status: 404 });

  await db.execute({
    sql: "UPDATE menu_items SET checked = ?, checked_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END WHERE id = ?",
    args: [body.checked ? 1 : 0, body.checked ? 1 : 0, itemId],
  });
  return NextResponse.json({ id: itemId, checked: body.checked, checked_at: body.checked ? new Date().toISOString() : null });
}
