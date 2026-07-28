// Compares what the food scan proposed against what the trainee actually saved.
// Every correction is evidence about where the scan is weak — which foods it
// misnames, and how far off its portion estimates are — so the prompt can be
// tuned from data instead of guesswork.
//
// Kept pure and SDK-free so it can be unit tested without a DB or the Anthropic SDK.

export interface ScanItem {
  name: string;
  estimated_weight_g: number;
  calories: number;
}

export type ScanCorrectionKind = "renamed" | "edited" | "added" | "removed";

export interface ScanCorrection {
  kind: ScanCorrectionKind;
  ai_name: string | null;
  final_name: string | null;
  ai_grams: number | null;
  final_grams: number | null;
  ai_calories: number | null;
  final_calories: number | null;
}

// Portions are eyeballed by both sides, so only flag a numeric edit once it is
// big enough to mean something. Below this the trainee is just nudging a slider.
const NUMERIC_TOLERANCE = 0.1;

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function toItem(value: Partial<ScanItem> | null | undefined): ScanItem {
  return {
    name: String(value?.name ?? "").trim(),
    estimated_weight_g: Math.round(Number(value?.estimated_weight_g) || 0),
    calories: Math.round(Number(value?.calories) || 0),
  };
}

function materiallyDifferent(before: number, after: number): boolean {
  if (before === after) return false;
  if (before <= 0) return after > 0;
  return Math.abs(after - before) / before > NUMERIC_TOLERANCE;
}

function numericEdit(ai: ScanItem, final: ScanItem): ScanCorrection | null {
  const gramsChanged = materiallyDifferent(ai.estimated_weight_g, final.estimated_weight_g);
  const caloriesChanged = materiallyDifferent(ai.calories, final.calories);
  if (!gramsChanged && !caloriesChanged) return null;
  return {
    kind: "edited",
    ai_name: ai.name,
    final_name: final.name,
    ai_grams: ai.estimated_weight_g,
    final_grams: final.estimated_weight_g,
    ai_calories: ai.calories,
    final_calories: final.calories,
  };
}

export function diffScanItems(
  originalItems: Array<Partial<ScanItem>>,
  finalItems: Array<Partial<ScanItem>>
): ScanCorrection[] {
  const ai = originalItems.map(toItem);
  const final = finalItems.map(toItem);
  const aiTaken = new Array(ai.length).fill(false);
  const finalTaken = new Array(final.length).fill(false);
  const corrections: ScanCorrection[] = [];

  // Pass 1 — same name on both sides. These are the confident pairings, so match
  // them before anything else and report only the numeric drift.
  for (let f = 0; f < final.length; f++) {
    if (!final[f].name) continue;
    const a = ai.findIndex((item, index) => !aiTaken[index] && normalizeName(item.name) === normalizeName(final[f].name));
    if (a === -1) continue;
    aiTaken[a] = true;
    finalTaken[f] = true;
    const edit = numericEdit(ai[a], final[f]);
    if (edit) corrections.push(edit);
  }

  // Pass 2 — whatever is left, paired in order. The trainee edits rows in place,
  // so an unmatched row in the same position is almost always a rename of it.
  let cursor = 0;
  for (let f = 0; f < final.length; f++) {
    if (finalTaken[f] || !final[f].name) continue;
    while (cursor < ai.length && aiTaken[cursor]) cursor++;
    if (cursor >= ai.length) break;
    aiTaken[cursor] = true;
    finalTaken[f] = true;
    corrections.push({
      kind: "renamed",
      ai_name: ai[cursor].name,
      final_name: final[f].name,
      ai_grams: ai[cursor].estimated_weight_g,
      final_grams: final[f].estimated_weight_g,
      ai_calories: ai[cursor].calories,
      final_calories: final[f].calories,
    });
  }

  // Anything still unmatched: the trainee added a food the scan missed entirely,
  // or deleted one it hallucinated. Both are the most valuable signals here.
  for (let f = 0; f < final.length; f++) {
    if (finalTaken[f] || !final[f].name) continue;
    corrections.push({
      kind: "added",
      ai_name: null,
      final_name: final[f].name,
      ai_grams: null,
      final_grams: final[f].estimated_weight_g,
      ai_calories: null,
      final_calories: final[f].calories,
    });
  }
  for (let a = 0; a < ai.length; a++) {
    if (aiTaken[a] || !ai[a].name) continue;
    corrections.push({
      kind: "removed",
      ai_name: ai[a].name,
      final_name: null,
      ai_grams: ai[a].estimated_weight_g,
      final_grams: null,
      ai_calories: ai[a].calories,
      final_calories: null,
    });
  }

  return corrections;
}
