import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

async function ownedMeal(mealId: string, coachId: string) {
  const result = await db.execute({
    sql: `SELECT mm.id, mp.id AS plan_id FROM menu_meals mm
          JOIN menu_days md ON md.id = mm.menu_day_id
          JOIN menu_plans mp ON mp.id = md.menu_plan_id
          JOIN users u ON u.id = mp.client_id
          WHERE mm.id = ? AND mp.coach_id = ? AND u.coach_id = ? AND u.role = 'client'`,
    args: [mealId, coachId, coachId],
  });
  return result.rows[0] ?? null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ mealId: string }> }) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();
  const { mealId } = await params;
  const row = await ownedMeal(mealId, coach.id);
  if (!row) return NextResponse.json({ error: "הארוחה לא נמצאה" }, { status: 404 });

  const body = await req.json();
  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : null;
  if (!label) return NextResponse.json({ error: "חסר שם ארוחה" }, { status: 400 });

  await db.batch([
    { sql: "UPDATE menu_meals SET label = ? WHERE id = ?", args: [label, mealId] },
    { sql: "UPDATE menu_plans SET updated_at = datetime('now') WHERE id = ?", args: [row.plan_id] },
  ], "write");
  return NextResponse.json({ ok: true, id: mealId, label });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ mealId: string }> }) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();
  const { mealId } = await params;
  const row = await ownedMeal(mealId, coach.id);
  if (!row) return NextResponse.json({ error: "הארוחה לא נמצאה" }, { status: 404 });

  await db.batch([
    { sql: "DELETE FROM menu_meals WHERE id = ?", args: [mealId] },
    { sql: "UPDATE menu_plans SET updated_at = datetime('now') WHERE id = ?", args: [row.plan_id] },
  ], "write");
  return NextResponse.json({ ok: true });
}
