import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ optionId: string }> }) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();
  const { optionId } = await params;
  const body = await req.json();
  const code = typeof body?.tzameretCode === "string" ? body.tzameretCode.replace(/^tz-/, "") : "";
  const grams = Number(body?.grams);
  if (!code || !Number.isFinite(grams) || grams <= 0 || grams > 5000) {
    return NextResponse.json({ error: "פרטי המזון אינם תקינים" }, { status: 400 });
  }

  const ownership = await db.execute({
    sql: `SELECT mp.id AS plan_id FROM menu_meal_options mo
          JOIN menu_meals mm ON mm.id = mo.menu_meal_id
          JOIN menu_days md ON md.id = mm.menu_day_id
          JOIN menu_plans mp ON mp.id = md.menu_plan_id
          JOIN users u ON u.id = mp.client_id
          WHERE mo.id = ? AND mp.coach_id = ? AND u.coach_id = ? AND u.role = 'client'`,
    args: [optionId, coach.id, coach.id],
  });
  const row = ownership.rows[0];
  if (!row) return NextResponse.json({ error: "התפריט לא נמצא" }, { status: 404 });

  const foodResult = await db.execute({
    sql: "SELECT code, name_he, calories, protein, carbs, fat FROM tzameret_foods WHERE code = ?",
    args: [code],
  });
  const food = foodResult.rows[0];
  if (!food) return NextResponse.json({ error: "המזון לא נמצא במאגר צמרת" }, { status: 404 });

  const scale = grams / 100;
  const item = {
    id: uuid(),
    menu_meal_option_id: optionId,
    tzameret_code: String(food.code),
    name_he: String(food.name_he),
    grams,
    calories: Math.round((Number(food.calories) || 0) * scale * 10) / 10,
    protein: Math.round((Number(food.protein) || 0) * scale * 10) / 10,
    carbs: Math.round((Number(food.carbs) || 0) * scale * 10) / 10,
    fat: Math.round((Number(food.fat) || 0) * scale * 10) / 10,
  };
  await db.batch([
    {
      sql: `INSERT INTO menu_items
              (id, menu_meal_option_id, tzameret_code, name_he, grams, calories, protein, carbs, fat)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [item.id, optionId, item.tzameret_code, item.name_he, grams, item.calories, item.protein, item.carbs, item.fat],
    },
    { sql: "UPDATE menu_plans SET updated_at = datetime('now') WHERE id = ?", args: [row.plan_id] },
  ], "write");

  return NextResponse.json(item, { status: 201 });
}
