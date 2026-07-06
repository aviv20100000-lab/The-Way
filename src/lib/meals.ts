import { v4 as uuid } from "uuid";
import db from "./db";
import type { Food, Meal, MealItem, MealType, User } from "./types";

function hebrewVariants(q: string): string[] {
  const normalized = q
    .replace(/ח/g, "כ").replace(/כ/g, "ח")
    .replace(/ק/g, "כ")
    .replace(/ש/g, "ס").replace(/ס/g, "ש")
    .replace(/ת/g, "ט").replace(/ט/g, "ת")
    .replace(/א/g, "ע").replace(/ע/g, "א")
    .replace(/ו/g, "ב").replace(/ב/g, "ו");
  return [...new Set([q, normalized])];
}

export async function searchFoods(query: string): Promise<Food[]> {
  const trimmed = query.trim();
  const variants = hebrewVariants(trimmed);
  const conditions = variants.flatMap(() => ["name_he LIKE ?", "name_en LIKE ?"]).join(" OR ");
  const args = variants.flatMap((v) => [`%${v}%`, `%${v}%`]);
  const res = await db.execute({ sql: `SELECT * FROM foods WHERE ${conditions} ORDER BY name_he LIMIT 20`, args });
  return res.rows.map((r) => r as unknown as Food);
}

export async function createMeal(data: {
  userId: string; photoUrl?: string; mealType: MealType; notes?: string; items: { foodId: string; quantity: number }[];
}): Promise<string> {
  const mealId = uuid();
  await db.batch([
    { sql: "INSERT INTO meals (id, user_id, photo_url, meal_type, notes) VALUES (?, ?, ?, ?, ?)", args: [mealId, data.userId, data.photoUrl ?? null, data.mealType, data.notes ?? null] },
    ...data.items.map((item) => ({
      sql: "INSERT INTO meal_items (id, meal_id, food_id, quantity, unit) VALUES (?, ?, ?, ?, ?)",
      args: [uuid(), mealId, item.foodId, item.quantity, "גרם"],
    })),
  ], "write");
  return mealId;
}

export async function getMealItems(mealId: string): Promise<(MealItem & { food: Food })[]> {
  const res = await db.execute({
    sql: `SELECT mi.*, f.id as food_id, f.name_he, f.name_en, f.calories, f.protein, f.carbs, f.fat, f.serving_size
          FROM meal_items mi JOIN foods f ON f.id = mi.food_id WHERE mi.meal_id = ?`,
    args: [mealId],
  });
  return res.rows.map((r) => ({
    id: r.id as string, meal_id: r.meal_id as string, food_id: r.food_id as string,
    quantity: r.quantity as number, unit: r.unit as string,
    food: { id: r.food_id as string, name_he: r.name_he as string, name_en: r.name_en as string | null, calories: r.calories as number, protein: r.protein as number, carbs: r.carbs as number, fat: r.fat as number, serving_size: r.serving_size as string },
  }));
}

export async function getMealsByUser(userId: string, date?: string): Promise<(Meal & { items: (MealItem & { food: Food })[] })[]> {
  let sql = "SELECT * FROM meals WHERE user_id = ?";
  const args: (string)[] = [userId];
  if (date) { sql += " AND date(logged_at) = date(?)"; args.push(date); }
  sql += " ORDER BY logged_at DESC";
  const res = await db.execute({ sql, args });
  const meals = res.rows.map((r) => r as unknown as Meal);
  return Promise.all(meals.map(async (meal) => ({ ...meal, items: await getMealItems(meal.id) })));
}

export async function getMealsForCoach(coachId: string, date?: string): Promise<(Meal & { items: (MealItem & { food: Food })[]; user: User })[]> {
  let sql = `SELECT m.*, u.id as uid, u.name as uname, u.email as uemail, u.role as urole, u.coach_id as ucoach
             FROM meals m JOIN users u ON u.id = m.user_id WHERE u.coach_id = ?`;
  const args: string[] = [coachId];
  if (date) { sql += " AND date(m.logged_at) = date(?)"; args.push(date); }
  sql += " ORDER BY m.logged_at DESC";
  const res = await db.execute({ sql, args });
  return Promise.all(res.rows.map(async (r) => ({
    id: r.id as string, user_id: r.user_id as string, photo_url: r.photo_url as string | null,
    meal_type: r.meal_type as MealType, notes: r.notes as string | null, logged_at: r.logged_at as string,
    user: { id: r.uid as string, name: r.uname as string, email: r.uemail as string, role: r.urole as "coach" | "client", coach_id: r.ucoach as string | null },
    items: await getMealItems(r.id as string),
  })));
}
