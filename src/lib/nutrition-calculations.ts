/**
 * Nutrition calculation utilities
 * Handles macro and calorie scaling based on gram adjustments
 */

export interface AiItem {
  name: string;
  estimated_weight_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ScaledMacro {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

/**
 * Scale food macros based on gram adjustments
 * If user adjusts portion size, all macros scale proportionally
 */
export function scaleFoodMacros(items: AiItem[], adjustedGrams: number[]): ScaledMacro[] {
  return items.map((item, i) => {
    const scaleFactor =
      item.estimated_weight_g > 0
        ? adjustedGrams[i] / item.estimated_weight_g
        : 1;

    return {
      calories: Math.round(item.calories * scaleFactor),
      carbs: Math.round(item.carbs_g * scaleFactor),
      protein: Math.round(item.protein_g * scaleFactor),
      fat: Math.round(item.fat_g * scaleFactor),
    };
  });
}

/**
 * Calculate total calories from scaled macros
 */
export function calculateTotalCalories(scaledMacros: ScaledMacro[]): number {
  return scaledMacros.reduce((sum, macro) => sum + macro.calories, 0);
}

/**
 * Get default grams for items (or use adjusted values)
 */
export function getItemGrams(
  items: AiItem[],
  adjustedGrams: number[] | Record<number, number>
): number[] {
  if (Array.isArray(adjustedGrams)) {
    return items.map((item, i) => adjustedGrams[i] ?? item.estimated_weight_g);
  }
  return items.map((item, i) => adjustedGrams[i] ?? item.estimated_weight_g);
}
