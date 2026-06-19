export type Role = "coach" | "client";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  coach_id: string | null;
}

export interface Food {
  id: string;
  name_he: string;
  name_en: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string;
}

export interface MealItem {
  id: string;
  meal_id: string;
  food_id: string;
  quantity: number;
  unit: string;
  food?: Food;
}

export interface Meal {
  id: string;
  user_id: string;
  photo_url: string | null;
  meal_type: MealType;
  notes: string | null;
  logged_at: string;
  items?: MealItem[];
  user?: User;
}

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "ארוחת בוקר",
  lunch: "ארוחת צהריים",
  dinner: "ארוחת ערב",
  snack: "חטיף",
};

export function calcItemNutrition(food: Food, quantity: number): NutritionTotals {
  const factor = quantity / 100;
  return {
    calories: Math.round(food.calories * factor),
    protein: Math.round(food.protein * factor * 10) / 10,
    carbs: Math.round(food.carbs * factor * 10) / 10,
    fat: Math.round(food.fat * factor * 10) / 10,
  };
}

export function sumNutrition(items: { food: Food; quantity: number }[]): NutritionTotals {
  return items.reduce(
    (acc, item) => {
      const n = calcItemNutrition(item.food, item.quantity);
      return {
        calories: acc.calories + n.calories,
        protein: acc.protein + n.protein,
        carbs: acc.carbs + n.carbs,
        fat: acc.fat + n.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
