import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSessionUser } from "@/lib/auth";
import db, { initDb, menuMealInsertStatement, menuMealsNeedsLegacyMealType } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();
  const { id: sourcePlanId } = await params;
  const body = await req.json();
  const clientId = typeof body?.client_id === "string" ? body.client_id.trim() : "";
  if (!clientId) return NextResponse.json({ error: "חסר client_id" }, { status: 400 });

  const [sourceResult, targetResult] = await Promise.all([
    db.execute({
      sql: `SELECT mp.* FROM menu_plans mp JOIN users u ON u.id = mp.client_id
            WHERE mp.id = ? AND mp.coach_id = ? AND u.coach_id = ? AND u.role = 'client'`,
      args: [sourcePlanId, coach.id, coach.id],
    }),
    db.execute({ sql: "SELECT id FROM users WHERE id = ? AND coach_id = ? AND role = 'client'", args: [clientId, coach.id] }),
  ]);
  const source = sourceResult.rows[0];
  if (!source) return NextResponse.json({ error: "תפריט המקור לא נמצא" }, { status: 404 });
  if (targetResult.rows.length === 0) return NextResponse.json({ error: "מתאמן היעד לא נמצא" }, { status: 404 });

  const [days, meals, options, items] = await Promise.all([
    db.execute({ sql: "SELECT id, day_index FROM menu_days WHERE menu_plan_id = ? ORDER BY day_index", args: [sourcePlanId] }),
    db.execute({
      sql: `SELECT mm.* FROM menu_meals mm JOIN menu_days md ON md.id = mm.menu_day_id
            WHERE md.menu_plan_id = ? ORDER BY md.day_index, mm.sort_order`,
      args: [sourcePlanId],
    }),
    db.execute({
      sql: `SELECT mo.* FROM menu_meal_options mo
            JOIN menu_meals mm ON mm.id = mo.menu_meal_id
            JOIN menu_days md ON md.id = mm.menu_day_id
            WHERE md.menu_plan_id = ? ORDER BY mo.sort_order`,
      args: [sourcePlanId],
    }),
    db.execute({
      sql: `SELECT mi.* FROM menu_items mi
            JOIN menu_meal_options mo ON mo.id = mi.menu_meal_option_id
            JOIN menu_meals mm ON mm.id = mo.menu_meal_id
            JOIN menu_days md ON md.id = mm.menu_day_id WHERE md.menu_plan_id = ?`,
      args: [sourcePlanId],
    }),
  ]);

  const newPlanId = uuid();
  const mealInsertSql = menuMealInsertStatement(await menuMealsNeedsLegacyMealType());
  const statements: Array<{ sql: string; args: unknown[] }> = [{
    sql: `INSERT INTO menu_plans
            (id, coach_id, client_id, title, daily_calories_target, daily_protein_target, is_template, status)
          VALUES (?, ?, ?, ?, ?, ?, 0, 'draft')`,
    args: [newPlanId, coach.id, clientId, source.title, source.daily_calories_target, source.daily_protein_target],
  }];
  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const sourceDay = days.rows.find((day) => Number(day.day_index) === dayIndex);
    const newDayId = uuid();
    statements.push({ sql: "INSERT INTO menu_days (id, menu_plan_id, day_index) VALUES (?, ?, ?)", args: [newDayId, newPlanId, dayIndex] });
    if (!sourceDay) continue;
    for (const meal of meals.rows.filter((entry) => entry.menu_day_id === sourceDay.id)) {
      const newMealId = uuid();
      statements.push({
        sql: mealInsertSql,
        args: [newMealId, newDayId, meal.label, meal.sort_order],
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
  }
  await db.batch(statements, "write");
  return NextResponse.json({ id: newPlanId, client_id: clientId, status: "draft" }, { status: 201 });
}
