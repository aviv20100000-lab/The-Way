import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

async function getOwnedPlan(planId: string, coachId: string) {
  const planResult = await db.execute({
    sql: `SELECT mp.* FROM menu_plans mp
          JOIN users u ON u.id = mp.client_id
          WHERE mp.id = ? AND mp.coach_id = ? AND u.coach_id = ? AND u.role = 'client'`,
    args: [planId, coachId, coachId],
  });
  return planResult.rows[0] ?? null;
}

async function fullPlan(planId: string, coachId: string) {
  const plan = await getOwnedPlan(planId, coachId);
  if (!plan) return null;

  const [daysResult, mealsResult, optionsResult, itemsResult] = await Promise.all([
    db.execute({ sql: "SELECT id, day_index FROM menu_days WHERE menu_plan_id = ? ORDER BY day_index", args: [planId] }),
    db.execute({
      sql: `SELECT mm.id, mm.menu_day_id, mm.label, mm.sort_order, mm.selected_option_id, mm.selected_at
            FROM menu_meals mm JOIN menu_days md ON md.id = mm.menu_day_id
            WHERE md.menu_plan_id = ? ORDER BY md.day_index, mm.sort_order`,
      args: [planId],
    }),
    db.execute({
      sql: `SELECT mo.id, mo.menu_meal_id, mo.label, mo.sort_order
            FROM menu_meal_options mo
            JOIN menu_meals mm ON mm.id = mo.menu_meal_id
            JOIN menu_days md ON md.id = mm.menu_day_id
            WHERE md.menu_plan_id = ? ORDER BY mo.sort_order`,
      args: [planId],
    }),
    db.execute({
      sql: `SELECT mi.* FROM menu_items mi
            JOIN menu_meal_options mo ON mo.id = mi.menu_meal_option_id
            JOIN menu_meals mm ON mm.id = mo.menu_meal_id
            JOIN menu_days md ON md.id = mm.menu_day_id
            WHERE md.menu_plan_id = ? ORDER BY mo.sort_order, mi.rowid`,
      args: [planId],
    }),
  ]);

  return {
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
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();
  const { id } = await params;
  const plan = await fullPlan(id, coach.id);
  if (!plan) return NextResponse.json({ error: "התפריט לא נמצא" }, { status: 404 });
  return NextResponse.json(plan);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  await initDb();
  const { id } = await params;
  if (!(await getOwnedPlan(id, coach.id))) return NextResponse.json({ error: "התפריט לא נמצא" }, { status: 404 });

  const body = await req.json();
  const updates: string[] = [];
  const args: Array<string | number | null> = [];
  if (typeof body?.title === "string" && body.title.trim()) {
    updates.push("title = ?");
    args.push(body.title.trim().slice(0, 120));
  }
  if (body?.daily_calories_target === null || Number.isFinite(Number(body?.daily_calories_target))) {
    updates.push("daily_calories_target = ?");
    args.push(body.daily_calories_target === null ? null : Math.max(0, Math.round(Number(body.daily_calories_target))));
  }
  if (body?.daily_protein_target === null || Number.isFinite(Number(body?.daily_protein_target))) {
    updates.push("daily_protein_target = ?");
    args.push(body.daily_protein_target === null ? null : Math.max(0, Math.round(Number(body.daily_protein_target))));
  }
  if (body?.status === "draft" || body?.status === "published") {
    updates.push("status = ?");
    args.push(body.status);
  }
  if (updates.length === 0) return NextResponse.json({ error: "אין שדות לעדכון" }, { status: 400 });

  args.push(id, coach.id);
  await db.execute({
    sql: `UPDATE menu_plans SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ? AND coach_id = ?`,
    args,
  });
  return NextResponse.json(await fullPlan(id, coach.id));
}
