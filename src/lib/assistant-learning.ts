export const ASSISTANT_FEEDBACK_ACTIONS = ["liked", "disliked", "saved"] as const;

export type AssistantFeedbackAction = typeof ASSISTANT_FEEDBACK_ACTIONS[number];

export type AssistantPreferenceProfile = {
  likedFoods: string[];
  dislikedFoods: string[];
  savedIdeas: string[];
  situations: string[];
  responseStyle: string[];
  priceSensitivity: string[];
};

export type AssistantPreferenceMemory = {
  likedNotes: string[];
  dislikedNotes: string[];
  savedNotes: string[];
  feedbackCount: number;
  profile?: AssistantPreferenceProfile | null;
};

const MAX_MEMORY_ITEMS = 6;
const MAX_NOTE_CHARS = 120;

const EMPTY_PROFILE: AssistantPreferenceProfile = {
  likedFoods: [],
  dislikedFoods: [],
  savedIdeas: [],
  situations: [],
  responseStyle: [],
  priceSensitivity: [],
};

const FOOD_SIGNALS = [
  "קוטג'",
  "גבינה לבנה",
  "יוגורט",
  "מעדן פרו",
  "טונה",
  "ביצים",
  "פריכיות",
  "פיתה כוסמין",
  "חזה עוף",
  "אורז",
  "מלפפונים",
  "תפוח ירוק",
  "תמר",
  "קפה",
  "שייק חלבון",
  "טוסט טעים",
];

const SITUATION_SIGNALS: Array<[string, string]> = [
  ["ערב", "צריך פתרונות לערב"],
  ["לילה", "צריך פתרונות ללילה"],
  ["רעב", "מתמודד עם רעב"],
  ["מתוק", "מחפש פתרונות למתוק"],
  ["סופר", "צריך בחירות בסופר"],
  ["אימון", "שואל סביב אימון"],
  ["בוקר", "צריך פתרונות בוקר קלים"],
];

export function isAssistantFeedbackAction(value: unknown): value is AssistantFeedbackAction {
  return typeof value === "string" && ASSISTANT_FEEDBACK_ACTIONS.includes(value as AssistantFeedbackAction);
}

export function parseMemoryList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, MAX_MEMORY_ITEMS);
  } catch {
    return [];
  }
}

export function parsePreferenceProfile(value: unknown): AssistantPreferenceProfile {
  if (typeof value !== "string") return { ...EMPTY_PROFILE };
  try {
    const parsed = JSON.parse(value) as Partial<AssistantPreferenceProfile>;
    return {
      likedFoods: parseMemoryList(JSON.stringify(parsed.likedFoods ?? [])),
      dislikedFoods: parseMemoryList(JSON.stringify(parsed.dislikedFoods ?? [])),
      savedIdeas: parseMemoryList(JSON.stringify(parsed.savedIdeas ?? [])),
      situations: parseMemoryList(JSON.stringify(parsed.situations ?? [])),
      responseStyle: parseMemoryList(JSON.stringify(parsed.responseStyle ?? [])),
      priceSensitivity: parseMemoryList(JSON.stringify(parsed.priceSensitivity ?? [])),
    };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function compactAssistantMemory(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s.,:;!?-]+|[\s.,:;!?-]+$/g, "")
    .slice(0, MAX_NOTE_CHARS)
    .trim();
}

export function buildFeedbackMemoryNote(messageContent: string, note?: string | null): string {
  const source = note?.trim() || messageContent;
  return compactAssistantMemory(source);
}

export function updateMemoryList(current: string[], note: string): string[] {
  if (!note) return current.slice(0, MAX_MEMORY_ITEMS);
  const normalized = note.toLowerCase();
  const withoutDuplicate = current.filter((item) => item.toLowerCase() !== normalized);
  return [note, ...withoutDuplicate].slice(0, MAX_MEMORY_ITEMS);
}

function findSignals(text: string, options: string[]): string[] {
  const normalized = text.toLowerCase();
  return options.filter((option) => normalized.includes(option.toLowerCase()));
}

function updateMany(current: string[], notes: string[]): string[] {
  return notes.reduce((next, note) => updateMemoryList(next, note), current);
}

export function updatePreferenceProfile(
  current: AssistantPreferenceProfile,
  action: AssistantFeedbackAction,
  messageContent: string,
  note?: string | null
): AssistantPreferenceProfile {
  const memoryNote = buildFeedbackMemoryNote(messageContent, note);
  const source = `${messageContent} ${note ?? ""}`;
  const foods = findSignals(source, FOOD_SIGNALS);
  const situations = SITUATION_SIGNALS
    .filter(([needle]) => source.toLowerCase().includes(needle))
    .map(([, label]) => label);
  const shortAnswer = messageContent.length < 260;
  const longAnswer = messageContent.length > 520;

  const next: AssistantPreferenceProfile = {
    likedFoods: [...current.likedFoods],
    dislikedFoods: [...current.dislikedFoods],
    savedIdeas: [...current.savedIdeas],
    situations: [...current.situations],
    responseStyle: [...current.responseStyle],
    priceSensitivity: [...current.priceSensitivity],
  };

  if (action === "liked") {
    next.likedFoods = updateMany(next.likedFoods, foods);
    next.situations = updateMany(next.situations, situations);
    if (shortAnswer) next.responseStyle = updateMemoryList(next.responseStyle, "אוהב תשובות קצרות וישירות");
  }

  if (action === "saved") {
    next.savedIdeas = updateMemoryList(next.savedIdeas, memoryNote);
    next.likedFoods = updateMany(next.likedFoods, foods);
    next.situations = updateMany(next.situations, situations);
  }

  if (action === "disliked") {
    next.responseStyle = updateMemoryList(
      next.responseStyle,
      longAnswer ? "פחות להתחיל בתשובה ארוכה" : "צריך לדייק יותר לשאלה האחרונה"
    );
    if (note) next.dislikedFoods = updateMany(next.dislikedFoods, foods);
  }

  if (/זול|תקציב|מחיר|יקר/.test(source)) {
    next.priceSensitivity = updateMemoryList(next.priceSensitivity, "רגיש למחיר ומעדיף פתרונות זולים");
  }

  return next;
}

export function buildPreferenceSummary(memory: AssistantPreferenceMemory): string | null {
  const lines: string[] = [];
  const profile = memory.profile;

  if (profile?.likedFoods.length) lines.push(`מזונות/פתרונות שעבדו לו: ${profile.likedFoods.join(", ")}`);
  if (profile?.dislikedFoods.length) lines.push(`דברים שפחות עבדו לו: ${profile.dislikedFoods.join(", ")}`);
  if (profile?.situations.length) lines.push(`מצבים שחוזרים אצלו: ${profile.situations.join(", ")}`);
  if (profile?.responseStyle.length) lines.push(`סגנון שמתאים לו: ${profile.responseStyle.join(", ")}`);
  if (profile?.priceSensitivity.length) lines.push(`מחיר: ${profile.priceSensitivity.join(", ")}`);
  if (profile?.savedIdeas.length) lines.push(`רעיונות שהוא שמר: ${profile.savedIdeas.join(" | ")}`);
  if (memory.likedNotes.length) lines.push(`תגובות שהוא אהב בעבר: ${memory.likedNotes.join(" | ")}`);
  if (memory.savedNotes.length) lines.push(`תגובות שהוא שמר/רצה לזכור: ${memory.savedNotes.join(" | ")}`);
  if (memory.dislikedNotes.length) lines.push(`תגובות שפחות עבדו לו: ${memory.dislikedNotes.join(" | ")}`);
  if (!lines.length) return null;
  lines.push("השתמש בזה כדי להתאים את ההמלצה, אבל אל תזכיר למתאמן שאתה שומר עליו פרופיל.");
  return lines.join("\n");
}
