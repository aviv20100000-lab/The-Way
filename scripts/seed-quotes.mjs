/**
 * seed-quotes.mjs
 * מריץ: node scripts/seed-quotes.mjs
 *
 * מה הסקריפט עושה:
 *  1. מכבה (active=0) את כל הציטוטים שאין בהם "שענני" בשם המחבר
 *  2. מוסיף ציטוטים חדשים ברמה גבוהה
 *
 * צריך: TURSO_URL ו-TURSO_TOKEN ב-.env.local
 */

import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── טוען משתני סביבה מ-.env.local ─────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const [key, ...rest] = line.split("=");
      if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
    }
  } catch {
    console.warn("לא נמצא .env.local — מניח שמשתני הסביבה כבר טעונים");
  }
}

loadEnv();

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

// ── הציטוטים החדשים ────────────────────────────────────────────────────────
const NEW_QUOTES = [
  // מיינדסט
  { text: "אתה לא בתחרות עם אף אחד. אתה בתחרות עם הגרסה שלך מאתמול.", author: null },
  { text: "קל להיות רגיל. קשה להיות יוצא מן הכלל. כנראה שאתה לא כאן בגלל שקל.", author: null },
  { text: "מי שמוצא תירוץ — לא מוצא תוצאה.", author: null },
  { text: "הגוף מגיע למקום שהמוח מסרב להגיע אליו קודם.", author: null },
  { text: "פחות תירוצים. יותר זיעה.", author: null },
  { text: "אל תחכה לסיבה. תהיה הסיבה.", author: null },
  { text: "גם בימים שהולך לאיטיות — אתה עדיין הולך.", author: null },
  { text: "היום ה-1 תמיד נראה קשה. יום 100 ייראה כמו ניצחון.", author: null },

  // אימון
  { text: "הגוף שלך לא מצטנע מאמץ — רק הראש שלך כן.", author: null },
  { text: "כל אימון שגמרת כשרצית לעזוב — זה הקסם הגדול.", author: null },
  { text: "אף אחד לא יוצא מאימון ומתחרט שהלך.", author: null },
  { text: "הכאב זמני. הגאווה נשארת.", author: null },
  { text: "ה-PR הכי חשוב הוא שיצאת מהבית.", author: null },
  { text: "לא בא לך לאמן? בוא בדיוק בגלל זה.", author: null },
  { text: "עוצמה לא נמדדת בכמה אתה מרים — אלא בכמה פעמים אתה קם.", author: null },

  // תזונה / ירידה במשקל
  { text: "החיטוב לא קורה בחדר הכושר — הוא קורה במטבח.", author: null },
  { text: "הבחירה הכי חזקה שאתה עושה היא מה אתה שם בצלחת.", author: null },
  { text: "ירידה במשקל היא מרתון, לא ספרינט. תפסיק לחפש קיצורי דרך.", author: null },
  { text: "אוכל טוב הוא לא עונש — זה פינוק שמכבד את הגוף.", author: null },
  { text: "הגוף הזה? הוא פרויקט שלך. תשקיע בו.", author: null },
  { text: "ההרגלים בונים שבוע בשבוע. הבטן לא נעלמת בלילה אחד — אבל היא נעלמת.", author: null },

  // השראה ישראלית
  { text: "שלושה חודשים ותגיד לעצמך תודה.", author: null },
  { text: "לא צריך להיות בכושר בשביל להתחיל. צריך להתחיל בשביל להיות בכושר.", author: null },
  { text: "אם לא ייצא לך היום — תעשה את זה בשביל מי שרצית להיות.", author: null },
  { text: "לאנשים יש אלפי סיבות לא להתחיל. לי יש סיבה אחת להמשיך — אני.", author: null },
];

async function main() {
  console.log("🔗 מתחבר למסד הנתונים...");

  // שלב 1: מכבה את כל הציטוטים שאין בהם "שענני"
  await db.execute(
    "UPDATE quotes SET active = 0 WHERE author NOT LIKE '%שענני%' OR author IS NULL"
  );
  console.log("✅ ציטוטים ישנים הוסתרו (חוץ מהציטוט של שענני קמחי)");

  // שלב 2: מוסיף ציטוטים חדשים
  let added = 0;
  for (const q of NEW_QUOTES) {
    await db.execute({
      sql: "INSERT INTO quotes (id, text, author, active) VALUES (?, ?, ?, 1)",
      args: [randomUUID(), q.text, q.author],
    });
    added++;
  }

  console.log(`✅ נוספו ${added} ציטוטים חדשים`);
  console.log("🎉 סיום! הציטוט של שענני קמחי נשמר, הכל שאר עודכן.");
  process.exit(0);
}

main().catch((e) => {
  console.error("שגיאה:", e);
  process.exit(1);
});
