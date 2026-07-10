// Pure helpers for the shopping assistant — kept SDK-free so they can be
// imported by tests and API routes without pulling in @anthropic-ai/sdk.

export const ASSISTANT_NAME = "העוזר";
export const ASSISTANT_MAX_INPUT_CHARS = 500;
export const ASSISTANT_HISTORY_LIMIT = 12;

export interface AssistantUserContext {
  name: string;
  dailyCalories: number | null;
  dailyProteinG: number | null;
  todayCalories: number;
  latestWeightKg: number | null;
  targetWeightKg: number | null;
  preferenceSummary?: string | null;
}

export interface AssistantHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export function buildContextBlock(context: AssistantUserContext): string {
  const lines = [`# המתאמן שמולך`, `שם: ${context.name}`];
  if (context.dailyCalories) {
    const remaining = Math.max(0, context.dailyCalories - context.todayCalories);
    lines.push(`יעד קלוריות יומי: ${context.dailyCalories} קל'. נאכלו היום: ${context.todayCalories} קל'. נשארו: ${remaining} קל'.`);
  } else {
    lines.push(`אין יעד קלוריות מוגדר — אפשר להציע לו לקבוע יעד עם המאמן.`);
  }
  if (context.dailyProteinG) lines.push(`יעד חלבון יומי: ${context.dailyProteinG} גרם.`);
  if (context.latestWeightKg) lines.push(`משקל אחרון: ${context.latestWeightKg} ק"ג.`);
  if (context.targetWeightKg) lines.push(`משקל יעד: ${context.targetWeightKg} ק"ג.`);
  lines.push(`השתמש בנתונים כדי להתאים את התשובה — אל תדקלם אותם סתם.`);
  if (context.preferenceSummary) {
    lines.push("# מה הבוט למד על הטעם של המתאמן");
    lines.push(context.preferenceSummary);
  }
  return lines.join("\n");
}
