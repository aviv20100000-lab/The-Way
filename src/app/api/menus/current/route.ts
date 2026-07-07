import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

export async function GET() {
  const client = await getSessionUser();
  if (!client || client.role !== "client") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();

  const planResult = await db.execute({
    sql: `SELECT id, title, daily_calories_target, daily_protein_target, status, updated_at
          FROM menu_plans
          WHERE client_id = ? AND status = 'published'
          ORDER BY updated_at DESC, created_at DESC LIMIT 1`,
    args: [client.id],
  });
  const plan = planResult.rows[0];
  if (!plan) return NextResponse.json(null);

  const [daysResult, mealsResult, optionsResult, itemsResult] = await Promise.all([
    db.execute({ sql: "SELECT id, day_index FROM menu_days WHERE menu_plan_id = ? ORDER BY day_index", args: [plan.id] }),
    db.execute({
      sql: `SELECT mm.id, mm.menu_day_id, mm.label, mm.sort_order, mm.selected_option_id, mm.selected_at
            FROM menu_meals mm JOIN menu_days md ON md.id = mm.menu_day_id
            WHERE md.menu_plan_id = ? ORDER BY md.day_index, mm.sort_order`,
      args: [plan.id],
    }),
    db.execute({
      sql: `SELECT mo.id, mo.menu_meal_id, mo.label, mo.sort_order
            FROM menu_meal_options mo
            JOIN menu_meals mm ON mm.id = mo.menu_meal_id
            JOIN menu_days md ON md.id = mm.menu_day_id
            WHERE md.menu_plan_id = ? ORDER BY mo.sort_order`,
      args: [plan.id],
    }),
    db.execute({
      sql: `SELECT mi.* FROM menu_items mi
            JOIN menu_meal_options mo ON mo.id = mi.menu_meal_option_id
            JOIN menu_meals mm ON mm.id = mo.menu_meal_id
            JOIN menu_days md ON md.id = mm.menu_day_id
            WHERE md.menu_plan_id = ? ORDER BY mo.sort_order, mi.rowid`,
      args: [plan.id],
    }),
  ]);
  return NextResponse.json({
    ...plan,
    days: daysResult.rows.map((day) => ({
      ...day,
      meals: mealsResult.rows
        .filter((meal) => meal.menu_day_id === day.id)
        .map((meal) => ({
          ...meal,
          options: optionsResult.rows
            .filter((option) => option.menu_meal_id === meal.id)
            .map((option) => ({
              ...option,
              items: itemsResult.rows.filter((item) => item.menu_meal_option_id === option.id),
            })),
        })),
    })),
  });
}
