import type Anthropic from "@anthropic-ai/sdk";
import { createMessage, SYSTEM_PROMPT as COACH_METHODOLOGY } from "./assistant";
import { searchTzameret, type TzameretFood } from "./tzameret";

// Same principle as menu-suggest.ts: the AI never reports nutrition numbers itself.
// It only reads the coach's messy free-text menu and extracts structure (days, meals,
// alternative options, food names, grams) — every nutrition value in the result comes
// from a real searchTzameret() lookup, scaled deterministically here. searchTzameret
// (unlike matchTzameret) only ever returns rows from tzameret_foods, so the resulting
// tzameret_code always satisfies menu_items' foreign key — matchTzameret can also
// return Aviv's hand-curated foods table entries, whose ids aren't in tzameret_foods
// and would violate that constraint and roll back the whole import.
const MENU_IMPORT_SYSTEM_PROMPT = `${COACH_METHODOLOGY}

---
המשימה שלך כרגע שונה לגמרי: אתה לא מדבר עם מתאמן. המאמן הדביק טקסט חופשי ומבולגן של תפריט שהוא כבר בנה (בוואטסאפ, בפתק, איך שהוא רגיל לכתוב), והתפקיד שלך הוא לפרק אותו למבנה מסודר - לא להמציא תוכן חדש.

כללים:
1. ימות השבוע ממוספרים 0-6: 0=ראשון, 1=שני, 2=שלישי, 3=רביעי, 4=חמישי, 5=שישי, 6=שבת. טווח כמו "א-ד" הוא [0,1,2,3]. אם המאמן לא ציין ימים בכלל, וכל הטקסט מתאר תפריט אחיד - תחיל אותו על כל השבוע [0,1,2,3,4,5,6].
2. כל שורה של ארוחה הופכת ל"meal" עם label (השם שהמאמן נתן, כמו "ארוחת בוקר" או "ביניים").
3. כשיש "/" בין שני מזונות או שילובי מזונות באותה ארוחה (למשל "חזה עוף/דג טונה") - זו חלופה, לא "גם וגם". תיצור option נפרד לכל צד של ה-"/", כדי שהמתאמן יבחר מה הוא באמת אכל (בדיוק כמו שאר האפליקציה עובדת - כל ארוחה יכולה להכיל כמה אפשרויות חלופיות).
4. מזונות שמופיעים יחד בלי "/" (מחוברים ב-"+" או בפסיק) הם באותה option אחת, כפריטים נפרדים.
5. לכל פריט מזון, תן "query" - שם מזון קצר וממשי לחיפוש (כמו "חזה עוף", "אורז לבן", "קוטג' 3%"), ו-"grams" - כמות בגרמים. אם המאמן כתב "יחידות" (כמו "3 ביצים", "תמר אחד") תעריך גרמים סבירים לפי ידע תזונתי כללי (ביצה בינונית ~50 גרם, תמר ~8 גרם וכו').
6. אם המאמן כתב "מב"פ" (מנת בסיס פחמימה/חלבון) עם מספר גרמים כולל (למשל "3 מב"פ חלבון- שווארמה (390 ג')") - תשתמש במספר הגרמים הכולל שהוא נתן, לא בערך המב"פ עצמו.
7. אל תמציא ארוחות או פריטים שלא מופיעים בטקסט. אם שורה לא ברורה או היא הערה כללית (כמו "להקפיד על 2-3 ליטר מים") - תתעלם ממנה, אל תהפוך אותה לפריט מזון.

החזר אך ורק JSON תקין, בלי שום טקסט נוסף לפניו או אחריו, במבנה הזה:
{"dayGroups": [
  {"days": [0,1,2,3], "meals": [
    {"label": "ארוחת בוקר", "options": [
      {"items": [{"query": "חזה עוף", "grams": 200}]},
      {"items": [{"query": "דג טונה", "grams": 150}]}
    ]}
  ]}
]}`;

export interface ImportedItem {
  query: string;
  grams: number;
}

export interface ImportedOption {
  items: ImportedItem[];
}

export interface ImportedMeal {
  label: string;
  options: ImportedOption[];
}

export interface ImportedDayGroup {
  days: number[];
  meals: ImportedMeal[];
}

export interface ResolvedItem {
  tzameretCode: string | null;
  name_he: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  query: string;
}

export interface ResolvedOption {
  items: ResolvedItem[];
}

export interface ResolvedMeal {
  label: string;
  options: ResolvedOption[];
}

export interface ResolvedDayGroup {
  days: number[];
  meals: ResolvedMeal[];
}

function clampDay(value: unknown): number | null {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= 6 ? n : null;
}

function parseDayGroups(text: string): ImportedDayGroup[] {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    const groups: unknown[] = Array.isArray(parsed?.dayGroups) ? parsed.dayGroups : [];
    return groups
      .map((group: unknown) => {
        const g = group as { days?: unknown; meals?: unknown };
        const days = Array.isArray(g.days)
          ? [...new Set(g.days.map((d: unknown) => clampDay(d)).filter((d): d is number => d !== null))]
          : [];
        const meals = Array.isArray(g.meals) ? g.meals : [];
        const parsedMeals: ImportedMeal[] = meals
          .map((meal: unknown) => {
            const m = meal as { label?: unknown; options?: unknown };
            const label = typeof m.label === "string" && m.label.trim() ? m.label.trim().slice(0, 60) : "ארוחה";
            const options = Array.isArray(m.options) ? m.options : [];
            const parsedOptions: ImportedOption[] = options
              .map((option: unknown) => {
                const o = option as { items?: unknown };
                const items = Array.isArray(o.items) ? o.items : [];
                const parsedItems: ImportedItem[] = items
                  .map((item: unknown) => {
                    const i = item as { query?: unknown; grams?: unknown };
                    const query = typeof i.query === "string" ? i.query.trim() : "";
                    const grams = Number.isFinite(Number(i.grams)) && Number(i.grams) > 0
                      ? Math.min(2000, Math.round(Number(i.grams)))
                      : 100;
                    return query ? { query, grams } : null;
                  })
                  .filter((i): i is ImportedItem => i !== null);
                return parsedItems.length > 0 ? { items: parsedItems } : null;
              })
              .filter((o): o is ImportedOption => o !== null);
            return parsedOptions.length > 0 ? { label, options: parsedOptions } : null;
          })
          .filter((m): m is ImportedMeal => m !== null);
        return days.length > 0 && parsedMeals.length > 0 ? { days, meals: parsedMeals } : null;
      })
      .filter((g): g is ImportedDayGroup => g !== null);
  } catch {
    return [];
  }
}

function scaleToItem(food: TzameretFood, grams: number, query: string): ResolvedItem {
  const ratio = grams / 100;
  return {
    tzameretCode: food.code,
    name_he: food.name_he,
    grams,
    calories: Math.round(food.calories * ratio * 10) / 10,
    protein: Math.round(food.protein * ratio * 10) / 10,
    carbs: Math.round(food.carbs * ratio * 10) / 10,
    fat: Math.round(food.fat * ratio * 10) / 10,
    query,
  };
}

const COMMON_TRAINER_FOODS: Array<{
  pattern: RegExp;
  name_he: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}> = [
  { pattern: /משקה\s*חלבון|(?:^|\s)פרו(?:\s|$)|\bpro\b/i, name_he: "משקה חלבון", calories: 60, protein: 10, carbs: 4, fat: 1 },
  { pattern: /אבקת\s*חלבון|סקופ\s*חלבון/i, name_he: "אבקת חלבון", calories: 400, protein: 75, carbs: 8, fat: 6 },
];

function fallbackTrainerFood(query: string, grams: number): ResolvedItem | null {
  const match = COMMON_TRAINER_FOODS.find((food) => food.pattern.test(query));
  if (!match) return null;
  const ratio = grams / 100;
  return {
    tzameretCode: null,
    name_he: match.name_he,
    grams,
    calories: Math.round(match.calories * ratio * 10) / 10,
    protein: Math.round(match.protein * ratio * 10) / 10,
    carbs: Math.round(match.carbs * ratio * 10) / 10,
    fat: Math.round(match.fat * ratio * 10) / 10,
    query,
  };
}

export async function importMenuText(text: string): Promise<{ dayGroups: ResolvedDayGroup[]; notFound: string[] }> {
  const response = await createMessage({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    temperature: 0.2,
    system: MENU_IMPORT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
  });

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const parsedGroups = parseDayGroups(responseText);
  const notFound: string[] = [];

  const dayGroups: ResolvedDayGroup[] = [];
  for (const group of parsedGroups) {
    const meals: ResolvedMeal[] = [];
    for (const meal of group.meals) {
      const options: ResolvedOption[] = [];
      for (const option of meal.options) {
        const items: ResolvedItem[] = [];
        for (const item of option.items) {
          const matches = await searchTzameret(item.query);
          const match = matches[0];
          if (!match) {
            const fallback = fallbackTrainerFood(item.query, item.grams);
            if (fallback) {
              items.push(fallback);
              continue;
            }
            notFound.push(item.query);
            continue;
          }
          items.push(scaleToItem(match, item.grams, item.query));
        }
        if (items.length > 0) options.push({ items });
      }
      if (options.length > 0) meals.push({ label: meal.label, options });
    }
    if (meals.length > 0) dayGroups.push({ days: group.days, meals });
  }

  return { dayGroups, notFound };
}
