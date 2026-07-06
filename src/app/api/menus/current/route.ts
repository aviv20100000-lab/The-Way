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

  const [daysResult, mealsResult, itemsResult] = await Promise.all([
    db.execute({ sql: "SELECT id, day_index FROM menu_days WHERE menu_plan_id = ? ORDER BY day_index", args: [plan.id] }),
    db.execute({
      sql: `SELECT mm.id, mm.menu_day_id, mm.meal_type, mm.sort_order
            FROM menu_meals mm JOIN menu_days md ON md.id = mm.menu_day_id
            WHERE md.menu_plan_id = ? ORDER BY md.day_index, mm.sort_order`,
      args: [plan.id],
    }),
    db.execute({
      sql: `SELECT mi.* FROM menu_items mi JOIN menu_meals mm ON mm.id = mi.menu_meal_id
            JOIN menu_days md ON md.id = mm.menu_day_id
            WHERE md.menu_plan_id = ? ORDER BY mm.sort_order, mi.rowid`,
      args: [plan.id],
    }),
  ]);
  return NextResponse.json({
    ...plan,
    days: daysResult.rows.map((day) => ({
      ...day,
      meals: mealsResult.rows
        .filter((meal) => meal.menu_day_id === day.id)
        .map((meal) => ({ ...meal, items: itemsResult.rows.filter((item) => item.menu_meal_id === meal.id) })),
    })),
  });
}
