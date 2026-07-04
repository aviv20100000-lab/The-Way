import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createMeal } from "@/lib/meals";
import { ensureSeed } from "@/lib/seed";
import db from "@/lib/db";
import type { MealType } from "@/lib/types";
import { getMealTypeForIsraelTime } from "@/lib/meal-time";

// Tzameret picks arrive as "tz-<code>" — copy them into the foods table so
// meal_items' JOIN on foods keeps working (id is stable, so this is idempotent).
async function materializeTzameretFood(foodId: string): Promise<boolean> {
  const code = foodId.slice(3);
  const row = (await db.execute({
    sql: "SELECT name_he, calories, protein, carbs, fat FROM tzameret_foods WHERE code = ?",
    args: [code],
  })).rows[0];
  if (!row) return false;
  await db.execute({
    sql: `INSERT OR IGNORE INTO foods (id, name_he, name_en, calories, protein, carbs, fat, serving_size)
          VALUES (?, ?, NULL, ?, ?, ?, ?, '100g')`,
    args: [foodId, String(row.name_he), Number(row.calories) || 0, Number(row.protein) || 0, Number(row.carbs) || 0, Number(row.fat) || 0],
  });
  return true;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (user.role !== "client") return NextResponse.json({ error: "רק מתאמנים יכולים לרשום ארוחות" }, { status: 403 });
  await ensureSeed();

  const body = await req.json();
  const mealType: MealType = getMealTypeForIsraelTime();

  // Accepts either the legacy single-item shape { foodId, quantity } or { items: [...] }
  const rawItems: { foodId?: unknown; quantity?: unknown }[] = Array.isArray(body.items)
    ? body.items
    : body.foodId
      ? [{ foodId: body.foodId, quantity: body.quantity }]
      : [];

  const items = rawItems
    .map((it) => ({ foodId: String(it.foodId ?? ""), quantity: Number(it.quantity) }))
    .filter((it) => it.foodId && Number.isFinite(it.quantity) && it.quantity > 0);

  if (items.length === 0 || items.length > 30) {
    return NextResponse.json({ error: "חסרים פרטים" }, { status: 400 });
  }

  for (const item of items) {
    if (item.foodId.startsWith("tz-")) {
      const ok = await materializeTzameretFood(item.foodId);
      if (!ok) return NextResponse.json({ error: "מאכל לא נמצא במאגר" }, { status: 400 });
    }
  }

  const mealId = await createMeal({ userId: user.id, mealType, items });
  return NextResponse.json({ id: mealId });
}
