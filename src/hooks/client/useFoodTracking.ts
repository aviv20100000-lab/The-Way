import { useCallback, useRef, useState } from "react";
import { compressImageToJpeg } from "@/lib/image-compression";
import { getCsrfToken } from "@/lib/csrf-client";

interface AiItem {
  name: string;
  estimated_weight_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence?: number;
  source?: "tzameret" | "ai";
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
  const [proteinGoal, setProteinGoal] = useState<number | null>(null);
  const [estimatingIndex, setEstimatingIndex] = useState<number | null>(null);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [mealsLoaded, setMealsLoaded] = useState(false);
  const [lastPhotoBlob, setLastPhotoBlob] = useState<File | null>(null);
  const [lastSavedMealId, setLastSavedMealId] = useState<string | null>(null);
  const [sharingMeal, setSharingMeal] = useState(false);
  const [shareMealError, setShareMealError] = useState("");
  const [mealShared, setMealShared] = useState(false);
  const [sharePromptDismissed, setSharePromptDismissed] = useState(false);
  const mealsLoadedRef = useRef(false);
  const nameTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const autoLookupByName = useCallback(async (index: number, name: string, grams: number) => {
    if (!name.trim()) return;
    setEstimatingIndex(index);
    try {
      const csrfToken = await getCsrfToken();
      const aiHeaders: HeadersInit = { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) };
      const res = await fetch("/api/foods/estimate", {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify({ name: name.trim(), grams }),
      });
      if (!res.ok) return;
      const n = await res.json();
      setAiResult((prev) =>
        prev ? {
          ...prev,
          items: prev.items.map((it, i) =>
            i === index ? {
              ...it,
              calories: n.calories ?? it.calories,
              protein_g: n.protein_g ?? it.protein_g,
              carbs_g: n.carbs_g ?? it.carbs_g,
              fat_g: n.fat_g ?? it.fat_g,
              source: n.source === "tzameret" ? "tzameret" : "ai",
            } : it
          ),
        } : prev
      );
    } catch (e) {
      console.error("autoLookupByName error:", e);
    } finally {
      setEstimatingIndex(null);
    }
  }, []);

  const analyzeFood = useCallback(async (file: File) => {
    setAnalyzing(true);
    setFoodError("");
    setAiResult(null);
    setMealSaved("idle");
    setMealShared(false);
    setShareMealError("");
    setSharePromptDismissed(false);
    setLastSavedMealId(null);
    try {
      // 1568px = Anthropic's max long edge — larger gets downscaled server-side
      // anyway, smaller loses detail the model needs (tuna/cottage-texture misses
      // were traced to 1200px on tall screenshots).
      const jpeg = await compressImageToJpeg(file, 1568, 0.9);
      setLastPhotoBlob(jpeg);
      const fd = new FormData();
      fd.append("photo", jpeg);
      fd.append("client_compression", jpeg === file ? "fallback" : "ok");

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
      setLastPhotoBlob(null);
    }
    setAnalyzing(false);
  }, []);

  const updateItemName = useCallback((index: number, name: string) => {
    setMealSaved("idle");
    let grams = 100;
    setAiResult((prev) => {
      if (prev?.items[index]) grams = prev.items[index].estimated_weight_g || 100;
      return prev ? { ...prev, items: prev.items.map((it, i) => (i === index ? { ...it, name } : it)) } : prev;
    });

    if (nameTimers.current[index]) clearTimeout(nameTimers.current[index]);
    nameTimers.current[index] = setTimeout(() => {
      autoLookupByName(index, name, grams);
    }, 800);
  }, [autoLookupByName]);

  const updateItemCalories = useCallback((index: number, calories: number) => {
    setMealSaved("idle");
    const safe = Math.max(1, Math.round(Number.isFinite(calories) ? calories : 1));
    setAiResult((prev) =>
      prev ? { ...prev, items: prev.items.map((it, i) => (i === index ? { ...it, calories: safe } : it)) } : prev
    );
  }, []);

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

  const estimateItemNutrition = useCallback(async (index: number) => {
    const current = aiResult?.items[index];
    const target = current
      ? { name: current.name.trim(), grams: current.estimated_weight_g }
      : null;
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
                      source: n.source === "tzameret" ? "tzameret" : "ai",
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
  }, [aiResult]);

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

  const loadMyMeals = useCallback(async (force = false) => {
    if (mealsLoadedRef.current && !force) return;
    mealsLoadedRef.current = true;
    setLoadingMeals(true);
    try {
      const res = await fetch("/api/foods/meals");
      if (!res.ok) throw new Error(`Meals request failed: ${res.status}`);
      const d = await res.json();
      setMyMeals(d.meals ?? []);
      setTodayCalories(d.today_calories ?? 0);
      setCalorieGoal(d.goal_calories ?? null);
      setProteinGoal(d.goal_protein_g ?? null);
    } catch (e) {
      mealsLoadedRef.current = false;
      console.error("Error loading meals:", e);
    } finally {
      setLoadingMeals(false);
      setMealsLoaded(true);
    }
  }, []);

  const deleteMeal = useCallback(async (id: string, source: "ai" | "quick" = "ai") => {
    setMyMeals((prev) => prev.filter((m) => m.id !== id));
    try {
      const { withCsrf } = await import("@/lib/csrf-client");
      const endpoint = source === "quick" ? `/api/meals/quick/${id}` : `/api/foods/meals/${id}`;
      await fetch(endpoint, { method: "DELETE", headers: await withCsrf({}) });
    } catch (e) {
      console.error("Error deleting meal:", e);
      loadMyMeals(true);
    }
  }, [loadMyMeals]);

  const logMeal = useCallback(
    async (items: { name: string; calories: number; estimated_weight_g: number }[], total: number) => {
      setMealSaved("saving");
      setShareMealError("");
      setMealShared(false);
      setSharePromptDismissed(false);
      setLastSavedMealId(null);
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
          const data = await res.json();
          setLastSavedMealId(typeof data.id === "string" ? data.id : null);
          setMealSaved("saved");
          await loadMyMeals(true);
        } else {
          setMealSaved("error");
        }
      } catch {
        setMealSaved("error");
      }
    },
    [loadMyMeals]
  );

  const shareMealToGroup = useCallback(async (mealId: string) => {
    if (!lastPhotoBlob) {
      setShareMealError("אין תמונה זמינה לשיתוף");
      return;
    }

    setSharingMeal(true);
    setShareMealError("");
    try {
      const uploadHeaders: HeadersInit = {};
      const csrfToken = await getCsrfToken();
      if (csrfToken) {
        uploadHeaders["x-csrf-token"] = csrfToken;
      }

      const uploadData = new FormData();
      uploadData.append("photo", lastPhotoBlob);

      const uploadRes = await fetch("/api/foods/meals/photo-upload", {
        method: "POST",
        headers: uploadHeaders,
        body: uploadData,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadJson.error || "שגיאה בהעלאת התמונה");
      }

      const shareHeaders: HeadersInit = { "Content-Type": "application/json" };
      if (csrfToken) {
        shareHeaders["x-csrf-token"] = csrfToken;
      }

      const shareRes = await fetch("/api/foods/meals/share", {
        method: "POST",
        headers: shareHeaders,
        body: JSON.stringify({ mealId, imageUrl: uploadJson.url }),
      });
      const shareJson = await shareRes.json();
      if (!shareRes.ok) {
        throw new Error(shareJson.error || "שגיאה בשיתוף לקבוצה");
      }

      setMealShared(true);
      setSharePromptDismissed(true);
    } catch (error) {
      setShareMealError(error instanceof Error ? error.message : "שגיאה בשיתוף לקבוצה");
    } finally {
      setSharingMeal(false);
    }
  }, [lastPhotoBlob]);

  const dismissSharePrompt = useCallback(() => {
    setSharePromptDismissed(true);
    setShareMealError("");
  }, []);

  const resetAiResult = useCallback(() => {
    setAiResult(null);
    setFoodError("");
    setMealSaved("idle");
    setLastPhotoBlob(null);
    setLastSavedMealId(null);
    setMealShared(false);
    setShareMealError("");
    setSharePromptDismissed(false);
  }, []);

  const startManualEntry = useCallback(() => {
    setAiResult({
      items: [{ name: "", estimated_weight_g: 100, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }],
      total_calories: 0,
      notes: "",
      photo_url: "",
    });
    setFoodError("");
    setMealSaved("idle");
    setLastPhotoBlob(null);
    setLastSavedMealId(null);
    setMealShared(false);
    setShareMealError("");
    setSharePromptDismissed(false);
  }, []);

  return {
    analyzing,
    aiResult,
    foodError,
    mealSaved,
    myMeals,
    todayCalories,
    calorieGoal,
    proteinGoal,
    estimatingIndex,
    loadingMeals,
    mealsLoaded,
    lastSavedMealId,
    sharingMeal,
    shareMealError,
    mealShared,
    sharePromptDismissed,
    analyzeFood,
    logMeal,
    shareMealToGroup,
    dismissSharePrompt,
    loadMyMeals,
    deleteMeal,
    resetAiResult,
    startManualEntry,
    updateItemName,
    updateItemCalories,
    updateItemGrams,
    estimateItemNutrition,
    deleteItem,
    addItem,
  };
}
