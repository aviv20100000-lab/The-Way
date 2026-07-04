import type { MealType } from "@/lib/types";

export const MEAL_TYPE_DETAILS: Record<MealType, { label: string; icon: string }> = {
  breakfast: { label: "ארוחת בוקר", icon: "🌅" },
  lunch: { label: "ארוחת צהריים", icon: "☀️" },
  dinner: { label: "ארוחת ערב", icon: "🌙" },
  snack: { label: "חטיף", icon: "🍎" },
};

export function getMealTypeForIsraelTime(date = new Date()): MealType {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).find((part) => part.type === "hour");
  const hour = Number(hourPart?.value ?? 0);

  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 16 && hour < 22) return "dinner";
  return "snack";
}
