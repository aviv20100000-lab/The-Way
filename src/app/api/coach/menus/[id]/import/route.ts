import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSessionUser } from "@/lib/auth";
import db, { initDb, menuMealInsertStatement, menuMealsNeedsLegacyMealType } from "@/lib/db";
import { checkPersistentRateLimit, formatResetIn } from "@/lib/ratelimit";
import { importMenuText } from "@/lib/menu-import";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await handleImport(req, params);
  } catch (error) {
    console.error("[coach/menus/:id/import POST]", error);
    const message = error instanceof Error ? error.message : "ייבוא התפריט נכשל";
    return NextResponse.json({ error: `MENU_FIX_V2: ייבוא התפריט נכשל: ${message}` }, { status: 500 });
  }
}

async function handleImport(req: NextRequest, paramsPromise: Promise<{ id: string }>) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const rateLimit = await checkPersistentRateLimit(`menu-import:${coach.id}`, "menuImport");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `הגעת למגבלת הייבוא היומית. נסה שוב בעוד ${formatResetIn(rateLimit.resetIn)} 🙏` },
      { status: 429 }
    );
  }

  await initDb();
  const { id: planId } = await paramsPromise;
  const body = await req.json().catch(() => ({}));
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 6000) : "";
  if (!text) return NextResponse.json({ error: "חסר טקסט לייבוא" }, { status: 400 });

  const ownership = await db.execute({
    sql: `SELECT md.id, md.day_index FROM menu_days md
          JOIN menu_plans mp ON mp.id = md.menu_plan_id
          JOIN users u ON u.id = mp.client_id
          WHERE mp.id = ? AND mp.coach_id = ? AND u.coach_id = ? AND u.role = 'client'`,
    args: [planId, coach.id, coach.id],
  });
  if (ownership.rows.length === 0) return NextResponse.json({ error: "התפריט לא נמצא" }, { status: 404 });
  const dayIdByIndex = new Map<number, string>();
  for (const row of ownership.rows) dayIdByIndex.set(Number(row.day_index), String(row.id));

  let parsed;
  try {
    parsed = await importMenuText(text);
  } catch (error) {
    console.error("[coach/menus/:id/import POST]", error);
    return NextResponse.json({ error: "לא הצלחנו לפרק את התפריט. נסה שוב." }, { status: 500 });
  }

  if (parsed.dayGroups.length === 0) {
    return NextResponse.json({ error: "לא הצלחנו לזהות ארוחות בטקסט שהודבק. נסה לנסח שוב או להוסיף ידנית.", notFound: parsed.notFound }, { status: 422 });
  }

  const statements: { sql: string; args: (string | number | null)[] }[] = [];
  let addedMeals = 0;
  const mealInsertSql = menuMealInsertStatement(await menuMealsNeedsLegacyMealType());

  for (const group of parsed.dayGroups) {
    for (const dayIndex of group.days) {
      const dayId = dayIdByIndex.get(dayIndex);
      if (!dayId) continue;
      const sortBase = await db.execute({
        sql: "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM menu_meals WHERE menu_day_id = ?",
        args: [dayId],
      });
      let sortOrder = Number(sortBase.rows[0]?.next_order ?? 0);

      for (const meal of group.meals) {
        const mealId = uuid();
        statements.push({ sql: mealInsertSql, args: [mealId, dayId, meal.label, sortOrder] });
        sortOrder += 1;
        addedMeals += 1;

        meal.options.forEach((option, optionIndex) => {
          const optionId = uuid();
          const HEBREW_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"];
          const label = `אפשרות ${HEBREW_LETTERS[optionIndex] ?? optionIndex + 1}׳`;
          statements.push({ sql: "INSERT INTO menu_meal_options (id, menu_meal_id, label, sort_order) VALUES (?, ?, ?, ?)", args: [optionId, mealId, label, optionIndex] });

          for (const item of option.items) {
            statements.push({
              sql: `INSERT INTO menu_items (id, menu_meal_option_id, tzameret_code, name_he, grams, calories, protein, carbs, fat)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [uuid(), optionId, item.tzameretCode, item.name_he, item.grams, item.calories, item.protein, item.carbs, item.fat],
            });
          }
        });
      }
    }
  }

  if (statements.length === 0) {
    return NextResponse.json({ error: "לא נמצאו ימים תואמים בתפריט לייבוא", notFound: parsed.notFound }, { status: 422 });
  }

  statements.push({ sql: "UPDATE menu_plans SET updated_at = datetime('now') WHERE id = ?", args: [planId] });

  try {
    await db.batch(statements, "write");
  } catch (error) {
    console.error("[coach/menus/:id/import POST batch]", error);
    const message = error instanceof Error ? error.message : "שמירת התפריט המיובא נכשלה";
    return NextResponse.json({ error: `MENU_FIX_V2: שמירת התפריט המיובא נכשלה: ${message}` }, { status: 500 });
  }

  return NextResponse.json({ addedMeals, notFound: parsed.notFound });
}
