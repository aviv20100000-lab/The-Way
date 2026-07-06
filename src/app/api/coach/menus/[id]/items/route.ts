import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 } as const;
type MealType = keyof typeof MEAL_ORDER;

function isMealType(value: string): value is MealType {
  return value in MEAL_ORDER;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();
  const { id: planId } = await params;
  const body = await req.json();
  const dayId = typeof body?.dayId === "string" ? body.dayId : "";
  const mealType = typeof body?.mealType === "string" ? body.mealType : "";
  const code = typeof body?.tzameretCode === "string" ? body.tzameretCode.replace(/^tz-/, "") : "";
  const grams = Number(body?.grams);
  if (!dayId || !isMealType(mealType) || !code || !Number.isFinite(grams) || grams <= 0 || grams > 5000) {
    return NextResponse.json({ error: "פרטי המזון אינם תקינים" }, { status: 400 });
  }

  const ownership = await db.execute({
    sql: `SELECT md.id FROM menu_days md
          JOIN menu_plans mp ON mp.id = md.menu_plan_id
          JOIN users u ON u.id = mp.client_id
          WHERE md.id = ? AND mp.id = ? AND mp.coach_id = ? AND u.coach_id = ? AND u.role = 'client'`,
    args: [dayId, planId, coach.id, coach.id],
  });
  if (ownership.rows.length === 0) return NextResponse.json({ error: "התפריט לא נמצא" }, { status: 404 });

  const foodResult = await db.execute({
    sql: "SELECT code, name_he, calories, protein, carbs, fat FROM tzameret_foods WHERE code = ?",
    args: [code],
  });
  const food = foodResult.rows[0];
  if (!food) return NextResponse.json({ error: "המזון לא נמצא במאגר צמרת" }, { status: 404 });

  await db.execute({
    sql: `INSERT INTO menu_meals (id, menu_day_id, meal_type, sort_order)
          VALUES (?, ?, ?, ?) ON CONFLICT(menu_day_id, meal_type) DO NOTHING`,
    args: [uuid(), dayId, mealType, MEAL_ORDER[mealType]],
  });
  const mealResult = await db.execute({
    sql: "SELECT id FROM menu_meals WHERE menu_day_id = ? AND meal_type = ?",
    args: [dayId, mealType],
  });
  const mealId = String(mealResult.rows[0]?.id || "");
  if (!mealId) return NextResponse.json({ error: "לא ניתן ליצור ארוחה" }, { status: 500 });

  const scale = grams / 100;
  const item = {
    id: uuid(),
    menu_meal_id: mealId,
    tzameret_code: String(food.code),
    name_he: String(food.name_he),
    grams,
    calories: Math.round((Number(food.calories) || 0) * scale * 10) / 10,
    protein: Math.round((Number(food.protein) || 0) * scale * 10) / 10,
    carbs: Math.round((Number(food.carbs) || 0) * scale * 10) / 10,
    fat: Math.round((Number(food.fat) || 0) * scale * 10) / 10,
    checked: 0,
    checked_at: null,
  };
  await db.execute({
    sql: `INSERT INTO menu_items
            (id, menu_meal_id, tzameret_code, name_he, grams, calories, protein, carbs, fat)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [item.id, mealId, item.tzameret_code, item.name_he, grams, item.calories, item.protein, item.carbs, item.fat],
  });
  await db.execute({ sql: "UPDATE menu_plans SET updated_at = datetime('now') WHERE id = ?", args: [planId] });
  return NextResponse.json(item, { status: 201 });
}
