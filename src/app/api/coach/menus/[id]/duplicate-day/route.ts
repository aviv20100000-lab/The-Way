import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSessionUser } from "@/lib/auth";
import db, { initDb, menuMealInsertStatement, menuMealsNeedsLegacyMealType } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();
  const { id: planId } = await params;
  const body = await req.json();
  const fromDayIndex = Number(body?.fromDayIndex);
  const toDayIndex = Number(body?.toDayIndex);
  if (!Number.isInteger(fromDayIndex) || !Number.isInteger(toDayIndex) || fromDayIndex < 0 || fromDayIndex > 6 || toDayIndex < 0 || toDayIndex > 6 || fromDayIndex === toDayIndex) {
    return NextResponse.json({ error: "בחירת הימים אינה תקינה" }, { status: 400 });
  }

  const days = await db.execute({
    sql: `SELECT md.id, md.day_index FROM menu_days md
          JOIN menu_plans mp ON mp.id = md.menu_plan_id
          JOIN users u ON u.id = mp.client_id
          WHERE mp.id = ? AND mp.coach_id = ? AND u.coach_id = ? AND u.role = 'client'
            AND md.day_index IN (?, ?)`,
    args: [planId, coach.id, coach.id, fromDayIndex, toDayIndex],
  });
  const sourceDay = days.rows.find((day) => Number(day.day_index) === fromDayIndex);
  const targetDay = days.rows.find((day) => Number(day.day_index) === toDayIndex);
  if (!sourceDay || !targetDay) return NextResponse.json({ error: "התפריט לא נמצא" }, { status: 404 });

  const meals = await db.execute({
    sql: "SELECT id, label, sort_order FROM menu_meals WHERE menu_day_id = ? ORDER BY sort_order",
    args: [sourceDay.id],
  });
  const options = await db.execute({
    sql: `SELECT mo.* FROM menu_meal_options mo JOIN menu_meals mm ON mm.id = mo.menu_meal_id
          WHERE mm.menu_day_id = ? ORDER BY mo.sort_order`,
    args: [sourceDay.id],
  });
  const items = await db.execute({
    sql: `SELECT mi.* FROM menu_items mi
          JOIN menu_meal_options mo ON mo.id = mi.menu_meal_option_id
          JOIN menu_meals mm ON mm.id = mo.menu_meal_id
          WHERE mm.menu_day_id = ? ORDER BY mo.sort_order, mi.rowid`,
    args: [sourceDay.id],
  });

  const statements: Array<{ sql: string; args: unknown[] }> = [
    { sql: "DELETE FROM menu_meals WHERE menu_day_id = ?", args: [targetDay.id] },
  ];
  const mealInsertSql = menuMealInsertStatement(await menuMealsNeedsLegacyMealType());
  for (const meal of meals.rows) {
    const newMealId = uuid();
    statements.push({
      sql: mealInsertSql,
      args: [newMealId, targetDay.id, meal.label, meal.sort_order],
    });
    for (const option of options.rows.filter((entry) => entry.menu_meal_id === meal.id)) {
      const newOptionId = uuid();
      statements.push({
        sql: "INSERT INTO menu_meal_options (id, menu_meal_id, label, sort_order) VALUES (?, ?, ?, ?)",
        args: [newOptionId, newMealId, option.label, option.sort_order],
      });
      for (const item of items.rows.filter((entry) => entry.menu_meal_option_id === option.id)) {
        statements.push({
          sql: `INSERT INTO menu_items
                  (id, menu_meal_option_id, tzameret_code, name_he, grams, calories, protein, carbs, fat)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [uuid(), newOptionId, item.tzameret_code, item.name_he, item.grams, item.calories, item.protein, item.carbs, item.fat],
        });
      }
    }
  }
  statements.push({ sql: "UPDATE menu_plans SET updated_at = datetime('now') WHERE id = ?", args: [planId] });
  await db.batch(statements, "write");
  return NextResponse.json({ ok: true });
}
