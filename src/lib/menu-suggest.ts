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
4. אם המאמן מבקש ירק או ירקות, תעדיף ירקות טריים/בסיסיים ורלוונטיים כמו "מלפפון", "עגבניה", "גזר", "ברוקולי", "פלפל", "חסה". אל תציע כבושים/חמוצים/משומרים/מטוגנים אלא אם המאמן ביקש את זה במפורש.
5. סגנון התפריטים של המאמן:
   - אורז + חזה עוף/הודו/פרגית שייך בעיקר לצהריים או לארוחה מרכזית ביום, לא כברירת מחדל לערב.
   - בערב תעדיף שילובים כמו: טונה במים, ביצים/חביתה, קוטג' 3%-5%, גבינה לבנה/גבינה 5%, פריכיות אורז, לחם קל, פיתה כוסמין, סלט, מלפפון, עגבניה, בצל, חסה, מעט שמן זית.
   - בלילה תעדיף משהו קטן: מעדן/יוגורט פרו 20 גרם חלבון, תמר, אגוז/שקד/קשיו בכמות קטנה, מלפפון, פרי אם מתאים.
   - לפני אימון אפשר להציע מעדן פרו/משקה פרו, קוטג', פרי, במבה קטנה רק אם זה מתאים לבקשה.
   - אם המאמן כתב "ארוחת ערב", "ערב", "לילה" או "ארוחת לילה", אל תציע "אורז" או "חזה עוף" אלא אם הוא ביקש אותם במפורש.

אתה לא ממציא ולא מדווח ערכים תזונתיים בעצמך — אלה תמיד יגיעו מחיפוש אמיתי במאגר צמרת, לא ממך. אתה רק בוחר מה לחפש ובאיזו כמות משוערת.

גם כשאתה חושב בעברית טבעית, הפלט למאמן חייב להיות JSON בלבד.
שמות החיפוש צריכים להיות קצרים וטבעיים בישראל: "קוטג' 5%", "טונה במים", "יוגורט חלבון", "מעדן פרו". לא משפטים, לא תיאורים שיווקיים, ולא ניסוח רשמי.

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

type SuggestTargets = {
  dailyCalories?: number | null;
  dailyProtein?: number | null;
  currentDayCalories?: number | null;
  currentMealCalories?: number | null;
};

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

function calorieLimitOf(request: string): number | null {
  const match = request.match(/(?:עד|מתחת ל|פחות מ)\s*(\d{2,4})\s*(?:קל|קלור)/);
  return match ? Number(match[1]) : null;
}

function remainingCaloriesOf(targets: SuggestTargets): number | null {
  if (!targets.dailyCalories || targets.currentDayCalories == null) return null;
  return Math.round(targets.dailyCalories - targets.currentDayCalories);
}

function fitGramsSoftlyToRemaining(food: TzameretFood, grams: number, remainingCalories: number | null) {
  if (remainingCalories == null || remainingCalories <= 0) return grams;
  const currentCalories = scaleToSuggestion(food, grams).calories;
  const softMax = remainingCalories * 1.15 + 80;
  if (currentCalories <= softMax) return grams;
  const adjusted = Math.round(grams * (softMax / currentCalories));
  return Math.max(30, Math.min(grams, adjusted));
}

function requestAllowsProcessed(request: string) {
  return /חמוץ|חמוצים|כבוש|כבושים|משומר|משומרים|קופס|מטוגן|מטוגנת/.test(request);
}

function isEveningRequest(request: string) {
  return /ערב|ארוחת\s*ערב|לילה|ארוחת\s*לילה|לפני\s*שינה/.test(request);
}

function explicitlyAskedForLunchStaple(request: string) {
  return /אורז|חזה\s*עוף|עוף|הודו|פרגית|בשר|שייטל|שווארמה/.test(request);
}

function isLunchStapleForEvening(query: string) {
  return /אורז|חזה\s*עוף/.test(query);
}

function defaultEveningSearches(request: string): RawSearch[] {
  const night = /לילה|לפני\s*שינה/.test(request);
  if (night) {
    return [
      { query: "מעדן פרו", grams: 200 },
      { query: "תמר", grams: 20 },
      { query: "שקד טבעי", grams: 15 },
      { query: "מלפפון", grams: 200 },
    ];
  }
  return [
    { query: "טונה במים", grams: 120 },
    { query: "ביצה", grams: 150 },
    { query: "קוטג' 3%", grams: 125 },
    { query: "פריכיות אורז", grams: 40 },
  ];
}

function applyCoachStyle(searches: RawSearch[], request: string): RawSearch[] {
  if (!isEveningRequest(request) || explicitlyAskedForLunchStaple(request)) return searches;
  const filtered = searches.filter((search) => !isLunchStapleForEvening(search.query));
  if (filtered.length > 0) return filtered;
  return defaultEveningSearches(request);
}

function isLessRelevantCandidate(food: TzameretFood, request: string) {
  if (requestAllowsProcessed(request)) return false;
  return /חמוץ|כבוש|משומר|מטוגן|ברוטב|מיובש/.test(food.name_he);
}

const GENERIC_SEARCH_WORDS = new Set([
  "ארוחה",
  "ארוחת",
  "בוקר",
  "צהריים",
  "ערב",
  "ביניים",
  "חלבון",
  "גבוה",
  "גבוהה",
  "דל",
  "דלה",
  "קל",
  "קלה",
  "קלוריות",
  "משהו",
]);

function searchVariants(query: string): string[] {
  const normalized = query
    .normalize("NFKC")
    .replace(/[",;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const meaningfulTokens = tokens.filter((token) => !GENERIC_SEARCH_WORDS.has(token));
  const variants = [
    normalized,
    meaningfulTokens.slice(0, 3).join(" "),
    meaningfulTokens.slice(0, 2).join(" "),
    ...meaningfulTokens,
  ].filter((value) => value.length >= 2);
  return [...new Set(variants)];
}

async function findBestTzameretMatch(query: string): Promise<TzameretFood | null> {
  for (const variant of searchVariants(query)) {
    const matches = await searchTzameret(variant);
    if (matches[0]) return matches[0];
  }
  return null;
}

async function findRelevantTzameretMatch(query: string, request: string, grams: number): Promise<TzameretFood | null> {
  const calorieLimit = calorieLimitOf(request);
  for (const variant of searchVariants(query)) {
    const matches = await searchTzameret(variant);
    const relevant = matches.find((candidate) => {
      if (isLessRelevantCandidate(candidate, request)) return false;
      if (calorieLimit !== null && scaleToSuggestion(candidate, grams).calories > calorieLimit) return false;
      return true;
    });
    if (relevant) return relevant;
  }
  return findBestTzameretMatch(query);
}

export async function suggestMenuFoods(
  request: string,
  targets: SuggestTargets
): Promise<MenuSuggestion[]> {
  const remainingCalories = remainingCaloriesOf(targets);
  const targetLine = [
    targets.dailyCalories ? `יעד קלוריות יומי לתפריט: ${targets.dailyCalories}` : null,
    targets.dailyProtein ? `יעד חלבון יומי לתפריט: ${targets.dailyProtein} גרם` : null,
    targets.currentDayCalories != null ? `קלוריות שכבר קיימות ביום הזה לפני ההצעה: ${Math.round(targets.currentDayCalories)}` : null,
    remainingCalories != null ? `קלוריות שנשארו בערך ליום הזה: ${remainingCalories}. התחשב בזה בעדינות, לא כחסם מוחלט.` : null,
    targets.currentMealCalories != null ? `קלוריות שכבר קיימות בחלופה/ארוחה הנוכחית: ${Math.round(targets.currentMealCalories)}` : null,
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

  const searches = applyCoachStyle(parseSearches(text), request);
  if (searches.length === 0) return [];

  const results: MenuSuggestion[] = [];
  const seenCodes = new Set<string>();
  for (const search of searches) {
    const best = await findRelevantTzameretMatch(search.query, request, search.grams);
    if (!best || seenCodes.has(best.code)) continue;
    seenCodes.add(best.code);
    results.push(scaleToSuggestion(best, fitGramsSoftlyToRemaining(best, search.grams, remainingCalories)));
  }
  return results;
}
