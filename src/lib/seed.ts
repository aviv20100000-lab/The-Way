import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";
import db, { initDb } from "./db";

const FOODS = [
  // ביצים ומוצרי חלב
  { name_he: "ביצה", name_en: "Egg", calories: 155, protein: 13, carbs: 1.1, fat: 11 },
  { name_he: "חביתה", name_en: "Omelette", calories: 154, protein: 10, carbs: 1, fat: 12 },
  { name_he: "קוטג' 5%", name_en: "Cottage cheese 5%", calories: 98, protein: 11, carbs: 3.4, fat: 4.3 },
  { name_he: "קוטג' 3%", name_en: "Cottage cheese 3%", calories: 72, protein: 11, carbs: 3.4, fat: 1.5 },
  { name_he: "גבינה לבנה 5%", name_en: "White cheese 5%", calories: 98, protein: 11, carbs: 3.4, fat: 4.3 },
  { name_he: "גבינה לבנה 9%", name_en: "White cheese 9%", calories: 130, protein: 10, carbs: 3, fat: 9 },
  { name_he: "שמנת חמוצה 15%", name_en: "Sour cream 15%", calories: 162, protein: 2.7, carbs: 3.4, fat: 15 },
  { name_he: "שמנת חמוצה 27%", name_en: "Sour cream 27%", calories: 267, protein: 2.1, carbs: 3.4, fat: 27 },
  { name_he: "יוגורט יווני", name_en: "Greek yogurt", calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  { name_he: "יוגורט 3%", name_en: "Yogurt 3%", calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3 },
  { name_he: "חלב 3%", name_en: "Milk 3%", calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
  { name_he: "חלב 1%", name_en: "Milk 1%", calories: 42, protein: 3.4, carbs: 5, fat: 1 },
  { name_he: "גבינה צהובה", name_en: "Yellow cheese", calories: 350, protein: 25, carbs: 1, fat: 28 },
  { name_he: "גבינת עמק", name_en: "Emek cheese", calories: 320, protein: 23, carbs: 1, fat: 25 },
  { name_he: "גבינת בולגרית", name_en: "Bulgarian cheese", calories: 260, protein: 16, carbs: 1, fat: 22 },
  { name_he: "לבן", name_en: "Laban", calories: 52, protein: 3.3, carbs: 4.6, fat: 1.8 },
  // עוף והודו
  { name_he: "חזה עוף", name_en: "Chicken breast", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name_he: "שוק עוף", name_en: "Chicken thigh", calories: 209, protein: 26, carbs: 0, fat: 11 },
  { name_he: "כנפי עוף", name_en: "Chicken wings", calories: 203, protein: 18, carbs: 0, fat: 14 },
  { name_he: "שווארמה עוף", name_en: "Chicken shawarma", calories: 195, protein: 25, carbs: 2, fat: 10 },
  { name_he: "שווארמה הודו", name_en: "Turkey shawarma", calories: 175, protein: 26, carbs: 2, fat: 7 },
  { name_he: "שווארמה טלה", name_en: "Lamb shawarma", calories: 230, protein: 22, carbs: 2, fat: 15 },
  { name_he: "שווארמה מיקס", name_en: "Mixed shawarma", calories: 210, protein: 23, carbs: 2, fat: 12 },
  { name_he: "חזה הודו", name_en: "Turkey breast", calories: 135, protein: 29, carbs: 0, fat: 1.5 },
  { name_he: "קבב עוף", name_en: "Chicken kebab", calories: 185, protein: 22, carbs: 4, fat: 9 },
  { name_he: "קבב בקר", name_en: "Beef kebab", calories: 240, protein: 20, carbs: 4, fat: 16 },
  { name_he: "קבב טלה", name_en: "Lamb kebab", calories: 250, protein: 19, carbs: 4, fat: 18 },
  { name_he: "שניצל עוף", name_en: "Chicken schnitzel", calories: 230, protein: 22, carbs: 12, fat: 10 },
  // בשר בקר ועגל
  { name_he: "בשר בקר רזה", name_en: "Lean beef", calories: 250, protein: 26, carbs: 0, fat: 15 },
  { name_he: "בשר עגל", name_en: "Veal", calories: 172, protein: 26, carbs: 0, fat: 7 },
  { name_he: "המבורגר בקר", name_en: "Beef burger", calories: 295, protein: 24, carbs: 0, fat: 21 },
  { name_he: "אנטריקוט", name_en: "Entrecote", calories: 271, protein: 24, carbs: 0, fat: 19 },
  { name_he: "צלעות בקר", name_en: "Beef ribs", calories: 291, protein: 19, carbs: 0, fat: 23 },
  // דגים
  { name_he: "סלמון", name_en: "Salmon", calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name_he: "טונה בשמן", name_en: "Tuna in oil", calories: 198, protein: 29, carbs: 0, fat: 8 },
  { name_he: "טונה במים", name_en: "Tuna in water", calories: 116, protein: 26, carbs: 0, fat: 1 },
  { name_he: "דג בס", name_en: "Sea bass", calories: 97, protein: 18, carbs: 0, fat: 2 },
  { name_he: "דג דניס", name_en: "Sea bream", calories: 100, protein: 19, carbs: 0, fat: 2.5 },
  { name_he: "שרימפס", name_en: "Shrimp", calories: 99, protein: 24, carbs: 0, fat: 0.3 },
  // פחמימות ולחמים
  { name_he: "לחם מלא", name_en: "Whole wheat bread", calories: 247, protein: 13, carbs: 41, fat: 3.4 },
  { name_he: "לחם לבן", name_en: "White bread", calories: 265, protein: 9, carbs: 49, fat: 3.2 },
  { name_he: "פיתה", name_en: "Pita bread", calories: 275, protein: 9, carbs: 55, fat: 1.2 },
  { name_he: "לאפה", name_en: "Laffa bread", calories: 285, protein: 9, carbs: 58, fat: 2 },
  { name_he: "בגט", name_en: "Baguette", calories: 270, protein: 9, carbs: 51, fat: 2 },
  { name_he: "אורז לבן", name_en: "White rice", calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { name_he: "אורז מלא", name_en: "Brown rice", calories: 112, protein: 2.6, carbs: 24, fat: 0.9 },
  { name_he: "פסטה", name_en: "Pasta", calories: 131, protein: 5, carbs: 25, fat: 1.1 },
  { name_he: "קוסקוס", name_en: "Couscous", calories: 112, protein: 3.8, carbs: 23, fat: 0.2 },
  { name_he: "בולגור", name_en: "Bulgur", calories: 83, protein: 3, carbs: 19, fat: 0.2 },
  { name_he: "שיבולת שועל", name_en: "Oatmeal", calories: 68, protein: 2.4, carbs: 12, fat: 1.4 },
  { name_he: "תפוח אדמה", name_en: "Potato", calories: 77, protein: 2, carbs: 17, fat: 0.1 },
  { name_he: "בטטה", name_en: "Sweet potato", calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { name_he: "צ'יפס", name_en: "French fries", calories: 312, protein: 3.4, carbs: 41, fat: 15 },
  // קטניות
  { name_he: "חומוס", name_en: "Hummus", calories: 166, protein: 8, carbs: 14, fat: 10 },
  { name_he: "פלאפל", name_en: "Falafel", calories: 333, protein: 13, carbs: 32, fat: 18 },
  { name_he: "עדשים", name_en: "Lentils", calories: 116, protein: 9, carbs: 20, fat: 0.4 },
  { name_he: "שעועית", name_en: "Beans", calories: 127, protein: 8.7, carbs: 22, fat: 0.5 },
  { name_he: "גרגירי חומוס", name_en: "Chickpeas", calories: 164, protein: 8.9, carbs: 27, fat: 2.6 },
  // ירקות
  { name_he: "עגבניה", name_en: "Tomato", calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { name_he: "מלפפון", name_en: "Cucumber", calories: 16, protein: 0.7, carbs: 3.6, fat: 0.1 },
  { name_he: "פלפל אדום", name_en: "Red pepper", calories: 31, protein: 1, carbs: 6, fat: 0.3 },
  { name_he: "פלפל ירוק", name_en: "Green pepper", calories: 20, protein: 0.9, carbs: 4.6, fat: 0.2 },
  { name_he: "חציל", name_en: "Eggplant", calories: 25, protein: 1, carbs: 6, fat: 0.2 },
  { name_he: "קישוא", name_en: "Zucchini", calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3 },
  { name_he: "ברוקולי", name_en: "Broccoli", calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { name_he: "כרובית", name_en: "Cauliflower", calories: 25, protein: 1.9, carbs: 5, fat: 0.3 },
  { name_he: "תרד", name_en: "Spinach", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { name_he: "גזר", name_en: "Carrot", calories: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  { name_he: "בצל", name_en: "Onion", calories: 40, protein: 1.1, carbs: 9, fat: 0.1 },
  { name_he: "שום", name_en: "Garlic", calories: 149, protein: 6.4, carbs: 33, fat: 0.5 },
  { name_he: "אבוקדו", name_en: "Avocado", calories: 160, protein: 2, carbs: 9, fat: 15 },
  { name_he: "זיתים", name_en: "Olives", calories: 115, protein: 0.8, carbs: 6, fat: 11 },
  { name_he: "סלט ירקות", name_en: "Vegetable salad", calories: 25, protein: 1.2, carbs: 5, fat: 0.2 },
  // פירות
  { name_he: "בננה", name_en: "Banana", calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { name_he: "תפוח", name_en: "Apple", calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { name_he: "תפוז", name_en: "Orange", calories: 47, protein: 0.9, carbs: 12, fat: 0.1 },
  { name_he: "ענבים", name_en: "Grapes", calories: 67, protein: 0.6, carbs: 17, fat: 0.4 },
  { name_he: "אבטיח", name_en: "Watermelon", calories: 30, protein: 0.6, carbs: 8, fat: 0.2 },
  { name_he: "מנגו", name_en: "Mango", calories: 60, protein: 0.8, carbs: 15, fat: 0.4 },
  { name_he: "תות שדה", name_en: "Strawberry", calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3 },
  { name_he: "אגס", name_en: "Pear", calories: 57, protein: 0.4, carbs: 15, fat: 0.1 },
  // ממרחים ורטבים
  { name_he: "טחינה", name_en: "Tahini", calories: 595, protein: 17, carbs: 21, fat: 54 },
  { name_he: "טחינה גולמית", name_en: "Raw tahini", calories: 592, protein: 17, carbs: 21, fat: 54 },
  { name_he: "חמאת בוטנים", name_en: "Peanut butter", calories: 588, protein: 25, carbs: 20, fat: 50 },
  { name_he: "שמן זית", name_en: "Olive oil", calories: 884, protein: 0, carbs: 0, fat: 100 },
  { name_he: "חמאה", name_en: "Butter", calories: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  { name_he: "מיונז", name_en: "Mayonnaise", calories: 680, protein: 1, carbs: 0.6, fat: 75 },
  { name_he: "קטשופ", name_en: "Ketchup", calories: 101, protein: 1.7, carbs: 27, fat: 0.1 },
  // אגוזים וזרעים
  { name_he: "שקדים", name_en: "Almonds", calories: 579, protein: 21, carbs: 22, fat: 50 },
  { name_he: "אגוזי מלך", name_en: "Walnuts", calories: 654, protein: 15, carbs: 14, fat: 65 },
  { name_he: "בוטנים", name_en: "Peanuts", calories: 567, protein: 26, carbs: 16, fat: 49 },
  { name_he: "זרעי צ'יה", name_en: "Chia seeds", calories: 486, protein: 17, carbs: 42, fat: 31 },
  // מאכלים ישראליים
  { name_he: "שקשוקה", name_en: "Shakshuka", calories: 160, protein: 8, carbs: 10, fat: 10 },
  { name_he: "סביח", name_en: "Sabich", calories: 310, protein: 12, carbs: 38, fat: 13 },
  { name_he: "חציל קלוי", name_en: "Grilled eggplant", calories: 45, protein: 1.5, carbs: 8, fat: 1.5 },
  { name_he: "מוסקה", name_en: "Moussaka", calories: 180, protein: 10, carbs: 12, fat: 10 },
  // מנות מוכנות ומסעדה
  { name_he: "פיצה (פרוסה)", name_en: "Pizza slice", calories: 285, protein: 12, carbs: 36, fat: 10 },
  { name_he: "בורגר", name_en: "Burger", calories: 480, protein: 28, carbs: 38, fat: 22 },
  { name_he: "אורז עם עוף", name_en: "Rice with chicken", calories: 250, protein: 20, carbs: 28, fat: 5 },
  { name_he: "מרק עוף", name_en: "Chicken soup", calories: 45, protein: 4, carbs: 4, fat: 1.5 },
  { name_he: "מרק עגבניות", name_en: "Tomato soup", calories: 50, protein: 1.5, carbs: 10, fat: 1 },
  // חטיפים ומתוקים
  { name_he: "שוקולד מריר", name_en: "Dark chocolate", calories: 546, protein: 5, carbs: 60, fat: 31 },
  { name_he: "שוקולד חלב", name_en: "Milk chocolate", calories: 535, protein: 8, carbs: 60, fat: 30 },
  { name_he: "עוגיות", name_en: "Cookies", calories: 480, protein: 5, carbs: 68, fat: 21 },
  { name_he: "חטיף במבה", name_en: "Bamba snack", calories: 540, protein: 9, carbs: 55, fat: 32 },
  { name_he: "חטיף ביסלי", name_en: "Bisli snack", calories: 480, protein: 7, carbs: 62, fat: 23 },
  { name_he: "גלידה", name_en: "Ice cream", calories: 207, protein: 3.5, carbs: 24, fat: 11 },
  // משקאות
  { name_he: "קפה שחור", name_en: "Black coffee", calories: 2, protein: 0.3, carbs: 0, fat: 0 },
  { name_he: "קפה עם חלב", name_en: "Coffee with milk", calories: 30, protein: 1.5, carbs: 3, fat: 1 },
  { name_he: "מיץ תפוזים", name_en: "Orange juice", calories: 45, protein: 0.7, carbs: 10, fat: 0.2 },
];

let seeded = false;

export async function ensureSeed() {
  if (seeded) return;

  await initDb();
  seeded = true;

  if (process.env.NODE_ENV === "production") {
    return;
  }

  // Always seed foods (in all environments) so production DB has full list
  for (const food of FOODS) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO foods (id, name_he, name_en, calories, protein, carbs, fat, serving_size) VALUES (?, ?, ?, ?, ?, ?, ?, '100g')",
      args: [uuid(), food.name_he, food.name_en, food.calories, food.protein, food.carbs, food.fat],
    });
  }

  if (process.env.NODE_ENV === "production") {
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
