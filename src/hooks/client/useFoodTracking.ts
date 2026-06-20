import { useCallback, useEffect, useState } from "react";
import { compressImageToJpeg } from "@/lib/image-compression";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

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
  const [itemGrams, setItemGrams] = useState<number[]>([]);
  const [mealSaved, setMealSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [myMeals, setMyMeals] = useState<MyMeal[]>([]);
  const [todayCalories, setTodayCalories] = useState(0);
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null);

  const analyzeFood = useCallback(async (file: File) => {
    setAnalyzing(true);
    setFoodError("");
    setAiResult(null);
    try {
      const jpeg = await compressImageToJpeg(file);
      const fd = new FormData();
      fd.append("photo", jpeg);

      const headers: HeadersInit = {};
      const csrfToken = getCookie("csrf-token");
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
    } catch (e: unknown) {
      setFoodError(e instanceof Error ? e.message : "שגיאה בניתוח התמונה");
    }
    setAnalyzing(false);
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
        const csrfToken = getCookie("csrf-token");
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
  }, []);

  useEffect(() => {
    setItemGrams(aiResult ? aiResult.items.map((it) => it.estimated_weight_g) : []);
    setMealSaved("idle");
  }, [aiResult]);

  return {
    analyzing,
    aiResult,
    foodError,
    itemGrams,
    mealSaved,
    myMeals,
    todayCalories,
    calorieGoal,
    setItemGrams,
    analyzeFood,
    logMeal,
    loadMyMeals,
    resetAiResult,
  };
}
