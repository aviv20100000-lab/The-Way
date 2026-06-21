import { useCallback, useState } from "react";
import { compressImageToJpeg } from "@/lib/image-compression";
import { getCsrfToken } from "@/lib/csrf-client";

interface AiItem {
  name: string;
  estimated_weight_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface AiResult {
  items: AiItem[];
  total_calories: number;
  notes: string;
  photo_url: string;
}

interface MyMeal {
  id: string;
  total_calories: number;
  logged_at: string;
  items: { name: string; calories: number; estimated_weight_g: number }[];
}

export function useFoodTracking() {
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [foodError, setFoodError] = useState("");
  const [mealSaved, setMealSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [myMeals, setMyMeals] = useState<MyMeal[]>([]);
  const [todayCalories, setTodayCalories] = useState(0);
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null);
  const [estimatingIndex, setEstimatingIndex] = useState<number | null>(null);

  const analyzeFood = useCallback(async (file: File) => {
    setAnalyzing(true);
    setFoodError("");
    setAiResult(null);
    setMealSaved("idle");
    try {
      const jpeg = await compressImageToJpeg(file);
      const fd = new FormData();
      fd.append("photo", jpeg);

      const headers: HeadersInit = {};
      const csrfToken = await getCsrfToken();
      if (csrfToken) {
        headers["x-csrf-token"] = csrfToken;
      }

      const res = await fetch("/api/foods/analyze", {
        method: "POST",
        body: fd,
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");
      setAiResult(data);
      setMealSaved("idle");
    } catch (e: unknown) {
      setFoodError(e instanceof Error ? e.message : "שגיאה בניתוח התמונה");
    }
    setAnalyzing(false);
  }, []);

  // --- Manual editing of the AI-detected items ---
  const updateItemName = useCallback((index: number, name: string) => {
    setMealSaved("idle");
    setAiResult((prev) =>
      prev ? { ...prev, items: prev.items.map((it, i) => (i === index ? { ...it, name } : it)) } : prev
    );
  }, []);

  const updateItemCalories = useCallback((index: number, calories: number) => {
    setMealSaved("idle");
    const safe = Math.max(0, Math.round(Number.isFinite(calories) ? calories : 0));
    setAiResult((prev) =>
      prev ? { ...prev, items: prev.items.map((it, i) => (i === index ? { ...it, calories: safe } : it)) } : prev
    );
  }, []);

  // Adjusting grams scales the item's calories/macros proportionally.
  const updateItemGrams = useCallback((index: number, newGrams: number) => {
    setMealSaved("idle");
    const grams = Math.max(1, Math.round(newGrams));
    setAiResult((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((it, i) => {
        if (i !== index) return it;
        const oldGrams = it.estimated_weight_g > 0 ? it.estimated_weight_g : grams;
        const ratio = oldGrams > 0 ? grams / oldGrams : 1;
        return {
          ...it,
          estimated_weight_g: grams,
          calories: Math.round(it.calories * ratio),
          protein_g: Math.round((it.protein_g || 0) * ratio),
          carbs_g: Math.round((it.carbs_g || 0) * ratio),
          fat_g: Math.round((it.fat_g || 0) * ratio),
        };
      });
      return { ...prev, items };
    });
  }, []);

  // Ask the AI to identify calories/macros for a (manually edited) item by its name + grams.
  const estimateItemNutrition = useCallback(async (index: number) => {
    let target: { name: string; grams: number } | null = null;
    setAiResult((prev) => {
      const it = prev?.items[index];
      if (it) target = { name: it.name.trim(), grams: it.estimated_weight_g };
      return prev;
    });
    if (!target || !target.name) return;

    setEstimatingIndex(index);
    setMealSaved("idle");
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      const csrfToken = await getCsrfToken();
      if (csrfToken) headers["x-csrf-token"] = csrfToken;

      const res = await fetch("/api/foods/estimate", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: target.name, grams: target.grams }),
      });
      if (!res.ok) return;
      const n = await res.json();
      setAiResult((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((it, i) =>
                i === index
                  ? {
                      ...it,
                      calories: n.calories ?? it.calories,
                      protein_g: n.protein_g ?? it.protein_g,
                      carbs_g: n.carbs_g ?? it.carbs_g,
                      fat_g: n.fat_g ?? it.fat_g,
                    }
                  : it
              ),
            }
          : prev
      );
    } catch (e) {
      console.error("Error estimating nutrition:", e);
    } finally {
      setEstimatingIndex(null);
    }
  }, []);

  const deleteItem = useCallback((index: number) => {
    setMealSaved("idle");
    setAiResult((prev) => (prev ? { ...prev, items: prev.items.filter((_, i) => i !== index) } : prev));
  }, []);

  const addItem = useCallback(() => {
    setMealSaved("idle");
    setAiResult((prev) =>
      prev
        ? {
            ...prev,
            items: [
              ...prev.items,
              { name: "", estimated_weight_g: 100, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
            ],
          }
        : prev
    );
  }, []);

  const loadMyMeals = useCallback(async () => {
    try {
      const res = await fetch("/api/foods/meals");
      if (!res.ok) return;
      const d = await res.json();
      setMyMeals(d.meals ?? []);
      setTodayCalories(d.today_calories ?? 0);
      setCalorieGoal(d.goal_calories ?? null);
    } catch (e) {
      console.error("Error loading meals:", e);
    }
  }, []);

  const logMeal = useCallback(
    async (items: { name: string; calories: number; estimated_weight_g: number }[], total: number) => {
      setMealSaved("saving");
      try {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        const csrfToken = await getCsrfToken();
        if (csrfToken) {
          headers["x-csrf-token"] = csrfToken;
        }

        const res = await fetch("/api/foods/meals", {
          method: "POST",
          headers,
          body: JSON.stringify({ items, total_calories: total }),
        });
        if (res.ok) {
          setMealSaved("saved");
          await loadMyMeals();
        } else {
          setMealSaved("error");
        }
      } catch {
        setMealSaved("error");
      }
    },
    [loadMyMeals]
  );

  const resetAiResult = useCallback(() => {
    setAiResult(null);
    setFoodError("");
    setMealSaved("idle");
  }, []);

  return {
    analyzing,
    aiResult,
    foodError,
    mealSaved,
    myMeals,
    todayCalories,
    calorieGoal,
    estimatingIndex,
    analyzeFood,
    logMeal,
    loadMyMeals,
    resetAiResult,
    updateItemName,
    updateItemCalories,
    updateItemGrams,
    estimateItemNutrition,
    deleteItem,
    addItem,
  };
}
