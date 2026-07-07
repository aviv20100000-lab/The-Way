import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ mealId: string }> }) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();
  const { mealId } = await params;

  const ownership = await db.execute({
    sql: `SELECT mp.id AS plan_id FROM menu_meals mm
          JOIN menu_days md ON md.id = mm.menu_day_id
          JOIN menu_plans mp ON mp.id = md.menu_plan_id
          JOIN users u ON u.id = mp.client_id
          WHERE mm.id = ? AND mp.coach_id = ? AND u.coach_id = ? AND u.role = 'client'`,
    args: [mealId, coach.id, coach.id],
  });
  const row = ownership.rows[0];
  if (!row) return NextResponse.json({ error: "הארוחה לא נמצאה" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const countResult = await db.execute({
    sql: "SELECT COUNT(*) AS c FROM menu_meal_options WHERE menu_meal_id = ?",
    args: [mealId],
  });
  const optionIndex = Number(countResult.rows[0]?.c ?? 0);
  const HEBREW_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"];
  const defaultLabel = `אפשרות ${HEBREW_LETTERS[optionIndex] ?? optionIndex + 1}׳`;
  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : defaultLabel;

  const optionId = uuid();
  await db.batch([
    { sql: "INSERT INTO menu_meal_options (id, menu_meal_id, label, sort_order) VALUES (?, ?, ?, ?)", args: [optionId, mealId, label, optionIndex] },
    { sql: "UPDATE menu_plans SET updated_at = datetime('now') WHERE id = ?", args: [row.plan_id] },
  ], "write");

  return NextResponse.json({ id: optionId, menu_meal_id: mealId, label, sort_order: optionIndex, items: [] }, { status: 201 });
}
