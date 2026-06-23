import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";
import db, { initDb } from "./db";

const FOODS = [
  { name_he: "ביצה", name_en: "Egg", calories: 155, protein: 13, carbs: 1.1, fat: 11 },
  { name_he: "לחם מלא", name_en: "Whole wheat bread", calories: 247, protein: 13, carbs: 41, fat: 3.4 },
  { name_he: "חזה עוף", name_en: "Chicken breast", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name_he: "אורז לבן", name_en: "White rice", calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { name_he: "אורז מלא", name_en: "Brown rice", calories: 112, protein: 2.6, carbs: 24, fat: 0.9 },
  { name_he: "סלמון", name_en: "Salmon", calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name_he: "טונה בשמן", name_en: "Tuna in oil", calories: 198, protein: 29, carbs: 0, fat: 8 },
  { name_he: "בננה", name_en: "Banana", calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { name_he: "תפוח", name_en: "Apple", calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { name_he: "אבוקדו", name_en: "Avocado", calories: 160, protein: 2, carbs: 9, fat: 15 },
  { name_he: "יוגורט יווני", name_en: "Greek yogurt", calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  { name_he: "גבינה לבנה 5%", name_en: "Cottage cheese 5%", calories: 98, protein: 11, carbs: 3.4, fat: 4.3 },
  { name_he: "שיבולת שועל", name_en: "Oatmeal", calories: 68, protein: 2.4, carbs: 12, fat: 1.4 },
  { name_he: "בטטה", name_en: "Sweet potato", calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { name_he: "פסטה", name_en: "Pasta", calories: 131, protein: 5, carbs: 25, fat: 1.1 },
  { name_he: "בשר בקר רזה", name_en: "Lean beef", calories: 250, protein: 26, carbs: 0, fat: 15 },
  { name_he: "חומוס", name_en: "Hummus", calories: 166, protein: 8, carbs: 14, fat: 10 },
  { name_he: "פיתה", name_en: "Pita bread", calories: 275, protein: 9, carbs: 55, fat: 1.2 },
  { name_he: "טחינה", name_en: "Tahini", calories: 595, protein: 17, carbs: 21, fat: 54 },
  { name_he: "סלט ירקות", name_en: "Vegetable salad", calories: 25, protein: 1.2, carbs: 5, fat: 0.2 },
  { name_he: "שקשוקה", name_en: "Shakshuka", calories: 160, protein: 8, carbs: 10, fat: 10 },
  { name_he: "חלב 3%", name_en: "Milk 3%", calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
  { name_he: "שקדים", name_en: "Almonds", calories: 579, protein: 21, carbs: 22, fat: 50 },
  { name_he: "אגוזי מלך", name_en: "Walnuts", calories: 654, protein: 15, carbs: 14, fat: 65 },
  { name_he: "שוקולד מריר", name_en: "Dark chocolate", calories: 546, protein: 5, carbs: 60, fat: 31 },
  { name_he: "קוטג' 5%", name_en: "Cottage cheese", calories: 98, protein: 11, carbs: 3.4, fat: 4.3 },
  { name_he: "פרוסת גבינה צהובה", name_en: "Yellow cheese slice", calories: 350, protein: 25, carbs: 1, fat: 28 },
  { name_he: "זיתים", name_en: "Olives", calories: 115, protein: 0.8, carbs: 6, fat: 11 },
  { name_he: "עגבניה", name_en: "Tomato", calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { name_he: "מלפפון", name_en: "Cucumber", calories: 16, protein: 0.7, carbs: 3.6, fat: 0.1 },
];

let seeded = false;
export async function ensureSeed() {
  if (seeded) return;
  if (process.env.NODE_ENV === "production") {
    return;
  }
  await initDb();
  seeded = true;

  const foodCount = (await db.execute("SELECT COUNT(*) as c FROM foods")).rows[0].c as number;
  if (foodCount === 0) {
    for (const food of FOODS) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO foods (id, name_he, name_en, calories, protein, carbs, fat, serving_size) VALUES (?, ?, ?, ?, ?, ?, ?, '100g')",
        args: [uuid(), food.name_he, food.name_en, food.calories, food.protein, food.carbs, food.fat],
      });
    }
  }

  const userCount = (await db.execute("SELECT COUNT(*) as c FROM users")).rows[0].c as number;
  if (userCount === 0) {
    const passwordHash = await bcrypt.hash("123456", 10);
    const coachId = uuid();
    const client1Id = uuid();
    const client2Id = uuid();
    await db.execute({ sql: "INSERT OR IGNORE INTO users (id, name, email, username, password_hash, role, coach_id) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [coachId, "המאמן", "coach@theway.com", "coach", passwordHash, "coach", null] });
    await db.execute({ sql: "INSERT OR IGNORE INTO users (id, name, email, username, password_hash, role, coach_id) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [client1Id, "דני", "dani@theway.com", "dani", passwordHash, "client", coachId] });
    await db.execute({ sql: "INSERT OR IGNORE INTO users (id, name, email, username, password_hash, role, coach_id) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [client2Id, "מיכל", "michal@theway.com", "michal", passwordHash, "client", coachId] });
  } else {
    // Migration: set username for existing users that don't have one yet
    await db.execute({ sql: "UPDATE users SET username = 'coach' WHERE email = 'coach@theway.com' AND (username IS NULL OR username = '')", args: [] });
    await db.execute({ sql: "UPDATE users SET username = 'dani' WHERE email = 'dani@theway.com' AND (username IS NULL OR username = '')", args: [] });
    await db.execute({ sql: "UPDATE users SET username = 'michal' WHERE email = 'michal@theway.com' AND (username IS NULL OR username = '')", args: [] });
  }
}
