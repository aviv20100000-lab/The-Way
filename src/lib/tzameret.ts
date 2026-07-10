import db, { initDb } from "./db";

export interface TzameretFood {
  code: string;
  name_he: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const COOKING_STATES = new Set([
  "מבושל", "מבושלת", "מטוגן", "מטוגנת", "צלוי", "צלויה", "אפוי", "אפויה",
]);

const COOKING_STATE_INFLECTIONS: Record<string, readonly string[]> = {
  מבושל: ["מבושל", "מבושלת", "מבושלים", "מבושלות"],
  מבושלת: ["מבושל", "מבושלת", "מבושלים", "מבושלות"],
  מטוגן: ["מטוגן", "מטוגנת", "מטוגנים", "מטוגנות"],
  מטוגנת: ["מטוגן", "מטוגנת", "מטוגנים", "מטוגנות"],
  צלוי: ["צלוי", "צלויה", "צלויים", "צלויות"],
  צלויה: ["צלוי", "צלויה", "צלויים", "צלויות"],
  אפוי: ["אפוי", "אפויה", "אפויים", "אפויות"],
  אפויה: ["אפוי", "אפויה", "אפויים", "אפויות"],
};

const DESCRIPTORS = new Set([
  "טרי", "טריה", "טריים", "קפוא", "קפואה", "פרוס",
  "פרוסה", "חתוך", "חתוכה", "מוכן", "מוכנה", "ביתי", "ביתית",
]);

function cookingStatesOf(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[(),;:–—-]/g, " ")
    .split(/\s+/)
    .filter((token) => COOKING_STATES.has(token));
}

function trainerSearchAliases(value: string) {
  const normalized = value.normalize("NFKC");
  const aliases: string[] = [];

  if (/שניצל/.test(normalized) && /חזה\s*עוף/.test(normalized) && /אפוי|בתנור|צלוי/.test(normalized)) {
    aliases.push("חזה עוף");
  }

  if (/משקה\s*חלבון|(?:^|\s)פרו(?:\s|$)|\bpro\b/i.test(normalized)) {
    aliases.push("משקה חלבון", "יוגורט חלבון");
  }

  return aliases;
}

function normalizedSearchCandidates(value: string) {
  return [...new Set([...trainerSearchAliases(value), value]
    .map((candidate) => normalizeTzameretName(candidate))
    .filter((candidate) => candidate.length >= 2))];
}

export function normalizeTzameretName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/["'׳״]/g, "")
    .replace(/\b\d+(?:\.\d+)?\s*%/g, " ")
    .replace(/[(),;:–—-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !DESCRIPTORS.has(token) && !COOKING_STATES.has(token))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_NAME_SQL = `lower(trim(
  replace(replace(replace(replace(replace(replace(replace(name_he,
    '"', ''), '''', ''), '׳', ''), '״', ''), ',', ' '), '(', ' '), ')', ' ')
))`;

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function toFood(row: Record<string, unknown> | undefined): TzameretFood | null {
  if (!row) return null;
  const code = String(row.code ?? "");
  const nameHe = String(row.name_he ?? "");
  if (!code || !nameHe) return null;
  return {
    code,
    name_he: nameHe,
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    carbs: Number(row.carbs) || 0,
    fat: Number(row.fat) || 0,
  };
}

async function findBy(mode: "exact" | "prefix" | "contains", term: string, cookingStates: string[]) {
  const terms = term.includes("תפוח אדמה")
    ? [term, term.replace("תפוח אדמה", "תפוחי אדמה")]
    : [term];
  const condition = terms.map(() => mode === "exact"
    ? `${NORMALIZED_NAME_SQL} = ?`
    : `${NORMALIZED_NAME_SQL} LIKE ? ESCAPE '\\'`
  ).join(" OR ");
  const searchArguments = terms.map((candidate) => {
    const escaped = escapeLike(candidate.toLowerCase());
    return mode === "exact" ? candidate.toLowerCase() : mode === "prefix" ? `${escaped}%` : `%${escaped}%`;
  });
  const preferredInflections = [...new Set(
    cookingStates.flatMap((state) => COOKING_STATE_INFLECTIONS[state] ?? [state])
  )];
  const cookingOrder = preferredInflections.length > 0
    ? `CASE WHEN ${preferredInflections.map(() => "name_he LIKE ? ESCAPE '\\'").join(" OR ")} THEN 0 ELSE 1 END,`
    : "";
  const result = await db.execute({
    sql: `SELECT code, name_he, calories, protein, carbs, fat
          FROM tzameret_foods
          WHERE (${condition}) AND name_he NOT LIKE 'FFQ%'
          ORDER BY ${cookingOrder} length(name_he) ASC, code ASC
          LIMIT 8`,
    args: [...searchArguments, ...preferredInflections.map((inflection) => `%${escapeLike(inflection)}%`)],
  });
  return result.rows
    .map((row) => toFood(row as Record<string, unknown>))
    .filter((food): food is TzameretFood => food !== null);
}

function pickCandidate(candidates: TzameretFood[], cookingStates: string[]) {
  if (candidates.length === 0) return null;
  if (cookingStates.length === 0) return candidates[0];

  const preferred = candidates.find((candidate) =>
    cookingStates.some((state) =>
      (COOKING_STATE_INFLECTIONS[state] ?? [state]).some((inflection) => candidate.name_he.includes(inflection))
    )
  );
  return preferred ?? candidates[0];
}

// The `foods` table now holds only hand-curated entries (shawarma etc.) — they win
// over Tzameret. Also covers foods Tzameret names in inverted order ("בשר עוף, חזה")
// that the ladder would otherwise mis-match (e.g. "חזה עוף" → schnitzel).
async function findCurated(term: string): Promise<TzameretFood | null> {
  const result = await db.execute({
    sql: `SELECT id, name_he, calories, protein, carbs, fat FROM foods
          WHERE ${NORMALIZED_NAME_SQL} = ? LIMIT 1`,
    args: [term.toLowerCase()],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row || !row.id || !row.name_he) return null;
  return {
    code: String(row.id),
    name_he: String(row.name_he),
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    carbs: Number(row.carbs) || 0,
    fat: Number(row.fat) || 0,
  };
}

// Broader lookup for the shopping assistant: returns up to 8 candidates so the
// model can compare products, instead of the single best match the scanner needs.
export async function searchTzameret(nameHe: string): Promise<TzameretFood[]> {
  await initDb();
  const cookingStates = cookingStatesOf(nameHe);
  const candidates = normalizedSearchCandidates(nameHe);
  if (candidates.length === 0) return [];

  for (const normalized of candidates) {
    for (const mode of ["exact", "prefix", "contains"] as const) {
      const results = await findBy(mode, normalized, cookingStates);
      if (results.length > 0) return results;
    }
  }
  return [];
}

export async function matchTzameret(nameHe: string): Promise<TzameretFood | null> {
  await initDb();
  const cookingStates = cookingStatesOf(nameHe);
  const candidates = normalizedSearchCandidates(nameHe);
  const normalized = candidates[candidates.length - 1] ?? "";
  if (!normalized) return null;

  for (const candidate of candidates) {
    const curated = await findCurated(candidate);
    if (curated) return curated;

    for (const mode of ["exact", "prefix", "contains"] as const) {
      const match = pickCandidate(await findBy(mode, candidate, cookingStates), cookingStates);
      if (match) return match;
    }
  }

  const firstTwoTokens = normalized.split(" ").slice(0, 2).join(" ");
  if (firstTwoTokens && firstTwoTokens !== normalized && firstTwoTokens.length >= 3) {
    const curatedShort = await findCurated(firstTwoTokens);
    if (curatedShort) return curatedShort;
    for (const mode of ["exact", "prefix", "contains"] as const) {
      const match = pickCandidate(await findBy(mode, firstTwoTokens, cookingStates), cookingStates);
      if (match) return match;
    }
  }

  return null;
}
