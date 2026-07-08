import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSessionUser } from "@/lib/auth";
import db, { initDb, menuMealInsertStatement, menuMealsNeedsLegacyMealType } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const coach = await getSessionUser();
    if (!coach || coach.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
    await initDb();
    const { id: planId } = await params;
    const body = await req.json().catch(() => ({}));
    const dayId = typeof body?.dayId === "string" ? body.dayId : "";
    const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : "ארוחה";
    if (!dayId) return NextResponse.json({ error: "חסר dayId" }, { status: 400 });

    const ownership = await db.execute({
      sql: `SELECT md.id FROM menu_days md
            JOIN menu_plans mp ON mp.id = md.menu_plan_id
            JOIN users u ON u.id = mp.client_id
            WHERE md.id = ? AND mp.id = ? AND mp.coach_id = ? AND u.coach_id = ? AND u.role = 'client'`,
      args: [dayId, planId, coach.id, coach.id],
    });
    if (ownership.rows.length === 0) return NextResponse.json({ error: "התפריט לא נמצא" }, { status: 404 });

    const sortResult = await db.execute({
      sql: "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM menu_meals WHERE menu_day_id = ?",
      args: [dayId],
    });
    const sortOrder = Number(sortResult.rows[0]?.next_order ?? 0);

    const mealId = uuid();
    const optionId = uuid();
    const mealInsertSql = menuMealInsertStatement(await menuMealsNeedsLegacyMealType());
    await db.batch([
      { sql: mealInsertSql, args: [mealId, dayId, label, sortOrder] },
      { sql: "INSERT INTO menu_meal_options (id, menu_meal_id, label, sort_order) VALUES (?, ?, 'אפשרות א׳', 0)", args: [optionId, mealId] },
      { sql: "UPDATE menu_plans SET updated_at = datetime('now') WHERE id = ?", args: [planId] },
    ], "write");

    return NextResponse.json({
      id: mealId,
      menu_day_id: dayId,
      label,
      sort_order: sortOrder,
      selected_option_id: null,
      selected_at: null,
      options: [{ id: optionId, menu_meal_id: mealId, label: "אפשרות א׳", sort_order: 0, items: [] }],
    }, { status: 201 });
  } catch (error) {
    console.error("[coach/menus/:id/meals POST]", error);
    const message = error instanceof Error ? error.message : "הוספת הארוחה נכשלה";
    return NextResponse.json({ error: `MENU_FIX_V2: הוספת הארוחה נכשלה: ${message}` }, { status: 500 });
  }
}
