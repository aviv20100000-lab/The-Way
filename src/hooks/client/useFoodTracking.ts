import { useCallback, useEffect, useState } from "react";

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

  const compressToJpeg = useCallback((file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height / width) * MAX);
            width = MAX;
          } else {
            width = Math.round((width / height) * MAX);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file),
          "image/jpeg",
          0.82
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const analyzeFood = useCallback(
    async (file: File) => {
      setAnalyzing(true);
      setFoodError("");
      setAiResult(null);
      try {
        const jpeg = await compressToJpeg(file);
        const fd = new FormData();
        fd.append("photo", jpeg);
        const res = await fetch("/api/foods/analyze", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "שגיאה");
        setAiResult(data);
      } catch (e: unknown) {
        setFoodError(e instanceof Error ? e.message : "שגיאה בניתוח התמונה");
      }
      setAnalyzing(false);
    },
    [compressToJpeg]
  );

  const logMeal = useCallback(
    async (items: { name: string; calories: number; estimated_weight_g: number }[], total: number) => {
      setMealSaved("saving");
      try {
        const res = await fetch("/api/foods/meals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
    []
  );

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
