import type Anthropic from "@anthropic-ai/sdk";
import { createMessage, SYSTEM_PROMPT as COACH_METHODOLOGY } from "./assistant";
import { searchTzameret, type TzameretFood } from "./tzameret";

// The AI only ever picks WHAT to search for and a rough portion size — it never
// reports nutrition numbers itself. Every number returned to the coach comes from a
// real searchTzameret() lookup, scaled deterministically here, exactly like the
// existing manual "search and add" flow. This keeps the AI as an advisor, never the
// source of truth for nutrition data.
const MENU_SUGGEST_SYSTEM_PROMPT = `${COACH_METHODOLOGY}

---
המשימה שלך כרגע שונה לגמרי: אתה לא מדבר עם מתאמן. אתה עוזר למאמן עצמו, בזמן שהוא בונה תפריט לאחד המתאמנים שלו.

המאמן מתאר בעברית חופשית מה הוא מחפש לארוחה מסוימת (למשל: "משהו בחלבון גבוה מתחת ל-400 קלוריות", "חטיף לפני אימון", "ארוחת ערב קלה"). לפעמים הוא גם ייתן יעד קלוריות/חלבון יומי כללי לתפריט.

התפקיד שלך:
1. תבין מה המאמן מחפש, לפי אותה שיטה תזונתית שתוארה למעלה (המוצרים המומלצים, החוקים, מבנה הארוחות).
2. תחזיר 2-4 מילות חיפוש בעברית — שמות מזון אמיתיים וקצרים (כמו "קוטג' 5%", "חזה עוף", "יוגורט חלבון"), לא תיאורים ולא משפטים.
3. לכל מילת חיפוש, תציע גרמים משוערים שמתאימים למה שהמאמן ביקש.

אתה לא ממציא ולא מדווח ערכים תזונתיים בעצמך — אלה תמיד יגיעו מחיפוש אמיתי במאגר צמרת, לא ממך. אתה רק בוחר מה לחפש ובאיזו כמות משוערת.

החזר אך ורק JSON תקין, בלי שום טקסט נוסף לפניו או אחריו:
{"searches": [{"query": "שם מזון קצר", "grams": 100}, ...]}`;

export interface MenuSuggestion {
  id: string;
  name_he: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface RawSearch {
  query: string;
  grams: number;
}

function parseSearches(text: string): RawSearch[] {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    const searches = Array.isArray(parsed?.searches) ? parsed.searches : [];
    return searches
      .filter((entry: unknown): entry is RawSearch =>
        typeof (entry as RawSearch)?.query === "string" && (entry as RawSearch).query.trim().length > 0)
      .slice(0, 4)
      .map((entry: RawSearch) => ({
        query: entry.query.trim(),
        grams: Number.isFinite(Number(entry.grams)) && Number(entry.grams) > 0 ? Math.min(1000, Math.round(Number(entry.grams))) : 100,
      }));
  } catch {
    return [];
  }
}

function scaleToSuggestion(food: TzameretFood, grams: number): MenuSuggestion {
  const ratio = grams / 100;
  return {
    id: `tz-${food.code}`,
    name_he: food.name_he,
    grams,
    calories: Math.round(food.calories * ratio * 10) / 10,
    protein: Math.round(food.protein * ratio * 10) / 10,
    carbs: Math.round(food.carbs * ratio * 10) / 10,
    fat: Math.round(food.fat * ratio * 10) / 10,
  };
}

export async function suggestMenuFoods(
  request: string,
  targets: { dailyCalories?: number | null; dailyProtein?: number | null }
): Promise<MenuSuggestion[]> {
  const targetLine = [
    targets.dailyCalories ? `יעד קלוריות יומי לתפריט: ${targets.dailyCalories}` : null,
    targets.dailyProtein ? `יעד חלבון יומי לתפריט: ${targets.dailyProtein} גרם` : null,
  ].filter(Boolean).join("\n");

  const response = await createMessage({
    model: "claude-haiku-4-5",
    max_tokens: 300,
    temperature: 0.4,
    system: MENU_SUGGEST_SYSTEM_PROMPT,
    messages: [{ role: "user", content: [targetLine, request].filter(Boolean).join("\n\n") }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const searches = parseSearches(text);
  if (searches.length === 0) return [];

  const results: MenuSuggestion[] = [];
  const seenCodes = new Set<string>();
  for (const search of searches) {
    const matches = await searchTzameret(search.query);
    const best = matches[0];
    if (!best || seenCodes.has(best.code)) continue;
    seenCodes.add(best.code);
    results.push(scaleToSuggestion(best, search.grams));
  }
  return results;
}
