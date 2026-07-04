import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";
import db, { initDb } from "./db";

// Nutrition search now runs on the official Tzameret DB (tzameret_foods).
// Only hand-tuned entries survive here — they win over Tzameret (see
// findCurated in src/lib/tzameret.ts) for cases where the official DB's
// closest match is wrong for how the word is actually eaten:
// - shawarma: back the meat-type clarification options
// - חומוס: Tzameret's shortest/closest match is dry raw chickpeas (364 kcal),
//   not ready-to-eat hummus spread (~170 kcal) — fixed 2026-07-02
const FOODS = [
  { name_he: "שווארמה עוף", name_en: "Chicken shawarma", calories: 195, protein: 25, carbs: 2, fat: 10 },
  { name_he: "שווארמה הודו", name_en: "Turkey shawarma", calories: 175, protein: 26, carbs: 2, fat: 7 },
  { name_he: "שווארמה טלה", name_en: "Lamb shawarma", calories: 230, protein: 22, carbs: 2, fat: 15 },
  { name_he: "שווארמה מיקס", name_en: "Mixed shawarma", calories: 210, protein: 23, carbs: 2, fat: 12 },
  { name_he: "חומוס", name_en: "Hummus", calories: 166, protein: 8, carbs: 14, fat: 10 },
];

let seeded = false;

export async function ensureSeed() {
  if (seeded) return;

  await initDb();
  seeded = true;

  // Seed foods in all environments (INSERT OR IGNORE by name_he to avoid duplicates)
  for (const food of FOODS) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO foods (id, name_he, name_en, calories, protein, carbs, fat, serving_size) SELECT ?, ?, ?, ?, ?, ?, ?, '100g' WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name_he = ?)",
      args: [uuid(), food.name_he, food.name_en, food.calories, food.protein, food.carbs, food.fat, food.name_he],
    });
  }

  if ((process.env.NODE_ENV as string) === "production") {
    return;
  }

  const userCount = (await db.execute("SELECT COUNT(*) as c FROM users")).rows[0].c as number;
  if (userCount === 0) {
    const passwordHash = await bcrypt.hash("123456", 10);
    const coachId = uuid();
    const client1Id = uuid();
    const client2Id = uuid();

    await db.execute({
      sql: "INSERT OR IGNORE INTO users (id, name, email, username, password_hash, role, coach_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [coachId, "המאמן", "coach@theway.com", "coach", passwordHash, "coach", null],
    });
    await db.execute({
      sql: "INSERT OR IGNORE INTO users (id, name, email, username, password_hash, role, coach_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [client1Id, "דני", "dani@theway.com", "dani", passwordHash, "client", coachId],
    });
    await db.execute({
      sql: "INSERT OR IGNORE INTO users (id, name, email, username, password_hash, role, coach_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [client2Id, "מיכל", "michal@theway.com", "מיכל", passwordHash, "client", coachId],
    });
  } else {
    await db.execute({
      sql: `
        UPDATE users
        SET username = lower(substr(trim(email), 1, instr(trim(email), '@') - 1))
        WHERE username IS NULL
           OR username = ''
           OR username = lower(trim(email))
           OR username = lower(trim(name))
      `,
      args: [],
    });
  }
}
