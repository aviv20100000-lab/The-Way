"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { withCsrf } from "@/lib/csrf-client";

type FoodSuggestion = { id: string; name_he: string; calories: number };
type AiSuggestion = { id: string; name_he: string; grams: number; calories: number; protein: number; carbs: number; fat: number };
type MenuItem = { id: string; name_he: string; grams: number; calories: number };
type MenuOption = { id: string; menu_meal_id: string; label: string; sort_order: number; items: MenuItem[] };
type MenuMeal = { id: string; menu_day_id: string; label: string; sort_order: number; selected_option_id: string | null; options: MenuOption[] };
type MenuDay = { id: string; day_index: number; meals: MenuMeal[] };
type MenuPlan = {
  id: string;
  title: string;
  daily_calories_target: number | null;
  daily_protein_target: number | null;
  status: "draft" | "published";
  days: MenuDay[];
};
type MenuSummary = Pick<MenuPlan, "id" | "title" | "daily_calories_target" | "daily_protein_target" | "status">;

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export default function MenuBuilder({ client, onClose, embedded = false }: { client: { id: string; name: string }; onClose?: () => void; embedded?: boolean }) {
  const [plans, setPlans] = useState<MenuSummary[]>([]);
  const [plan, setPlan] = useState<MenuPlan | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [title, setTitle] = useState(`תפריט של ${client.name}`);
  const [caloriesTarget, setCaloriesTarget] = useState("");
  const [proteinTarget, setProteinTarget] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [copyTarget, setCopyTarget] = useState(1);
  const [newMealLabel, setNewMealLabel] = useState("");
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [grams, setGrams] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<Record<string, FoodSuggestion[]>>({});
  const [selectedFoods, setSelectedFoods] = useState<Record<string, FoodSuggestion | undefined>>({});
  const [aiQueries, setAiQueries] = useState<Record<string, string>>({});
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AiSuggestion[]>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiError, setAiError] = useState<Record<string, string>>({});
  const [coachAiTargetOptionId, setCoachAiTargetOptionId] = useState("");
  const [importText, setImportText] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importNotFound, setImportNotFound] = useState<string[]>([]);

  const loadPlan = useCallback(async (planId: string) => {
    const response = await fetch(`/api/coach/menus/${planId}`, { cache: "no-store" });
    if (!response.ok) throw new Error("לא ניתן לטעון את התפריט");
    const data: MenuPlan = await response.json();
    setPlan(data);
    setTitle(data.title);
    setCaloriesTarget(data.daily_calories_target == null ? "" : String(data.daily_calories_target));
    setProteinTarget(data.daily_protein_target == null ? "" : String(data.daily_protein_target));
  }, []);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/coach/menus?clientId=${encodeURIComponent(client.id)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("לא ניתן לטעון תפריטים");
      const data: MenuSummary[] = await response.json();
      setPlans(data);
      if (data[0]) await loadPlan(data[0].id);
      else setPlan(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא ניתן לטעון תפריטים");
    } finally {
      setLoading(false);
    }
  }, [client.id, loadPlan]);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

  const day = plan?.days.find((entry) => Number(entry.day_index) === activeDay);
  const dayOptions = useMemo(
    () => (day?.meals ?? []).flatMap((meal) => meal.options.map((option) => ({ meal, option }))),
    [day]
  );
  const coachAiTargetOption = dayOptions.find((entry) => entry.option.id === coachAiTargetOptionId)?.option ?? dayOptions[0]?.option;

  useEffect(() => {
    if (coachAiTargetOptionId && dayOptions.some((entry) => entry.option.id === coachAiTargetOptionId)) return;
    setCoachAiTargetOptionId(dayOptions[0]?.option.id ?? "");
  }, [coachAiTargetOptionId, dayOptions]);
  const dayCalories = useMemo(
    () => day?.meals.flatMap((meal) => meal.options.flatMap((option) => option.items)).reduce((sum, item) => sum + Number(item.calories || 0), 0) ?? 0,
    [day]
  );
  const numericTarget = Number(caloriesTarget || 0);
  const targetProgress = numericTarget > 0 ? Math.min(100, Math.round((dayCalories / numericTarget) * 100)) : 0;

  const responseError = async (response: Response, fallback: string) => {
    const body = await response.json().catch(() => ({}));
    return typeof body?.error === "string" ? body.error : fallback;
  };

  const createPlan = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/coach/menus", {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          client_id: client.id,
          title,
          daily_calories_target: caloriesTarget ? Number(caloriesTarget) : null,
          daily_protein_target: proteinTarget ? Number(proteinTarget) : null,
        }),
      });
      if (!response.ok) throw new Error("יצירת התפריט נכשלה");
      const created = await response.json();
      await loadPlans();
      await loadPlan(created.id);
      setMessage("התפריט נוצר כטיוטה");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "יצירת התפריט נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const savePlan = async (status: "draft" | "published") => {
    if (!plan) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/coach/menus/${plan.id}`, {
        method: "PATCH",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          title,
          daily_calories_target: caloriesTarget ? Number(caloriesTarget) : null,
          daily_protein_target: proteinTarget ? Number(proteinTarget) : null,
          status,
        }),
      });
      if (!response.ok) throw new Error("שמירת התפריט נכשלה");
      const updated: MenuPlan = await response.json();
      setPlan(updated);
      setPlans((current) => current.map((entry) => entry.id === updated.id ? { ...entry, title: updated.title, daily_calories_target: updated.daily_calories_target, daily_protein_target: updated.daily_protein_target, status: updated.status } : entry));
      setMessage(status === "published" ? "התפריט פורסם ללקוח" : "הטיוטה נשמרה");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "שמירת התפריט נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const addMeal = async () => {
    if (!plan || !day || !newMealLabel.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/coach/menus/${plan.id}/meals`, {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ dayId: day.id, label: newMealLabel.trim() }),
      });
      if (!response.ok) throw new Error(await responseError(response, "הוספת הארוחה נכשלה"));
      await loadPlan(plan.id);
      setNewMealLabel("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "הוספת הארוחה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const renameMeal = async (mealId: string, label: string) => {
    if (!plan || !label.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/coach/menus/meals/${mealId}`, {
        method: "PATCH",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ label: label.trim() }),
      });
      if (!response.ok) throw new Error("שינוי שם הארוחה נכשל");
      await loadPlan(plan.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "שינוי שם הארוחה נכשל");
    } finally {
      setSaving(false);
    }
  };

  const deleteMeal = async (mealId: string) => {
    if (!plan) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/coach/menus/meals/${mealId}`, { method: "DELETE", headers: await withCsrf() });
      if (!response.ok) throw new Error("מחיקת הארוחה נכשלה");
      await loadPlan(plan.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "מחיקת הארוחה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const addOption = async (mealId: string) => {
    if (!plan) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/coach/menus/meals/${mealId}/options`, {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
      });
      if (!response.ok) throw new Error(await responseError(response, "הוספת האפשרות נכשלה"));
      await loadPlan(plan.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "הוספת האפשרות נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const deleteOption = async (optionId: string) => {
    if (!plan) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/coach/menus/options/${optionId}`, { method: "DELETE", headers: await withCsrf() });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "מחיקת האפשרות נכשלה");
      }
      await loadPlan(plan.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "מחיקת האפשרות נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const foodQueryTokens = useMemo(() => new Map<string, number>(), []);

  const findFoods = async (optionId: string, query: string) => {
    setQueries((current) => ({ ...current, [optionId]: query }));
    setSelectedFoods((current) => ({ ...current, [optionId]: undefined }));
    const token = (foodQueryTokens.get(optionId) ?? 0) + 1;
    foodQueryTokens.set(optionId, token);
    if (query.trim().length < 2) {
      setSuggestions((current) => ({ ...current, [optionId]: [] }));
      return;
    }
    try {
      const response = await fetch(`/api/foods?q=${encodeURIComponent(query)}`);
      const data: FoodSuggestion[] = await response.json();
      if (foodQueryTokens.get(optionId) !== token) return;
      setSuggestions((current) => ({ ...current, [optionId]: Array.isArray(data) ? data.filter((food) => food.id.startsWith("tz-")).slice(0, 6) : [] }));
    } catch {
      if (foodQueryTokens.get(optionId) !== token) return;
      setSuggestions((current) => ({ ...current, [optionId]: [] }));
    }
  };

  const addFood = async (optionId: string) => {
    const food = selectedFoods[optionId];
    const amount = Number(grams[optionId] || 100);
    if (!plan || !food || !Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/coach/menus/options/${optionId}/items`, {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ tzameretCode: food.id, grams: amount }),
      });
      if (!response.ok) throw new Error(await responseError(response, "הוספת המזון נכשלה"));
      await loadPlan(plan.id);
      setQueries((current) => ({ ...current, [optionId]: "" }));
      setGrams((current) => ({ ...current, [optionId]: "" }));
      setSuggestions((current) => ({ ...current, [optionId]: [] }));
      setSelectedFoods((current) => ({ ...current, [optionId]: undefined }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "הוספת המזון נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const askAi = async (optionId: string) => {
    const request = aiQueries[optionId]?.trim();
    if (!request) return;
    setAiLoading((current) => ({ ...current, [optionId]: true }));
    setAiError((current) => ({ ...current, [optionId]: "" }));
    try {
      const response = await fetch("/api/coach/menus/suggest", {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          request,
          dailyCalories: caloriesTarget ? Number(caloriesTarget) : null,
          dailyProtein: proteinTarget ? Number(proteinTarget) : null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "לא הצלחנו לקבל הצעות");
      if (!Array.isArray(body.suggestions) || body.suggestions.length === 0) {
        throw new Error("לא נמצאו הצעות שמתאימות למאגר צמרת. נסה לכתוב שם מזון ספציפי יותר.");
      }
      setAiSuggestions((current) => ({ ...current, [optionId]: body.suggestions ?? [] }));
    } catch (cause) {
      setAiError((current) => ({ ...current, [optionId]: cause instanceof Error ? cause.message : "לא הצלחנו לקבל הצעות" }));
    } finally {
      setAiLoading((current) => ({ ...current, [optionId]: false }));
    }
  };

  const addAiSuggestion = async (optionId: string, suggestion: AiSuggestion) => {
    if (!plan) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/coach/menus/options/${optionId}/items`, {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ tzameretCode: suggestion.id, grams: suggestion.grams }),
      });
      if (!response.ok) throw new Error(await responseError(response, "הוספת המזון נכשלה"));
      await loadPlan(plan.id);
      setAiSuggestions((current) => ({ ...current, [optionId]: (current[optionId] ?? []).filter((entry) => entry.id !== suggestion.id) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "הוספת המזון נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!plan) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/coach/menus/items/${itemId}`, { method: "DELETE", headers: await withCsrf() });
      if (!response.ok) throw new Error("מחיקת הפריט נכשלה");
      await loadPlan(plan.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "מחיקת הפריט נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const importMenu = async () => {
    if (!plan || !importText.trim()) return;
    setImportLoading(true);
    setImportError("");
    setImportNotFound([]);
    setMessage("");
    try {
      const response = await fetch(`/api/coach/menus/${plan.id}/import`, {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ text: importText }),
      });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseBody.error || "ייבוא התפריט נכשל");
      await loadPlan(plan.id);
      setImportText("");
      setImportNotFound(Array.isArray(responseBody.notFound) ? responseBody.notFound : []);
      setMessage(`נוספו ${responseBody.addedMeals ?? 0} ארוחות מהטקסט שהודבק`);
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : "ייבוא התפריט נכשל");
    } finally {
      setImportLoading(false);
    }
  };

  const duplicateDay = async () => {
    if (!plan || copyTarget === activeDay) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/coach/menus/${plan.id}/duplicate-day`, {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ fromDayIndex: activeDay, toDayIndex: copyTarget }),
      });
      if (!response.ok) throw new Error("העתקת היום נכשלה");
      await loadPlan(plan.id);
      setActiveDay(copyTarget);
      setMessage(`יום ${DAYS[activeDay]} הועתק ליום ${DAYS[copyTarget]}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "העתקת היום נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const panel = (
      <section dir="rtl" className={`${embedded ? "w-full" : "mx-auto h-full max-w-3xl overflow-y-auto"} bg-[#10130f] p-4 sm:rounded-3xl sm:border sm:border-[#444933] sm:p-6`} onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div><p className="text-xs font-bold text-[#c3f400]">בניית תפריט</p><h2 className="text-xl font-black text-white">{client.name}</h2></div>
          {onClose && <button type="button" onClick={onClose} aria-label="סגור" className="rounded-full border border-[#444933] px-3 py-1.5 text-xl text-[#c4c9ac]">×</button>}
        </div>

        {loading ? <div className="skeleton h-80 rounded-3xl" /> : (
          <div className="space-y-5">
            {plans.length > 0 && (
              <div className="flex gap-2">
                <select value={plan?.id ?? ""} onChange={(event) => void loadPlan(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#444933] bg-[#1e2020] px-3 py-2 text-sm text-white">
                  {!plan && <option value="">תפריט חדש</option>}
                  {plans.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status === "published" ? "פורסם" : "טיוטה"}</option>)}
                </select>
                <button type="button" onClick={() => { setPlan(null); setTitle(`תפריט של ${client.name}`); setCaloriesTarget(""); setProteinTarget(""); }} className="rounded-xl border border-[#444933] px-3 py-2 text-sm text-[#c3f400]">חדש</button>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="sm:col-span-1"><span className="text-xs text-[#8e9379]">שם התפריט</span><input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-xl border border-[#444933] bg-[#1e2020] px-3 py-2 text-white" /></label>
              <label><span className="text-xs text-[#8e9379]">יעד קלוריות</span><input type="number" value={caloriesTarget} onChange={(event) => setCaloriesTarget(event.target.value)} className="mt-1 w-full rounded-xl border border-[#444933] bg-[#1e2020] px-3 py-2 text-white" /></label>
              <label><span className="text-xs text-[#8e9379]">יעד חלבון</span><input type="number" value={proteinTarget} onChange={(event) => setProteinTarget(event.target.value)} className="mt-1 w-full rounded-xl border border-[#444933] bg-[#1e2020] px-3 py-2 text-white" /></label>
            </div>

            {!plan ? (
              <button type="button" disabled={saving} onClick={() => void createPlan()} className="w-full rounded-xl bg-[#c3f400] py-3 font-bold text-[#161e00] disabled:opacity-50">צור תפריט חדש</button>
            ) : (
              <>
                <div className={`rounded-2xl border p-3 text-sm ${plan.status === "published" ? "border-[#c3f400]/30 bg-[#c3f400]/10 text-[#d7ff52]" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>
                  {plan.status === "published"
                    ? "התפריט מפורסם ומופיע עכשיו אצל המתאמן."
                    : "התפריט שמור כטיוטה ולא מופיע אצל המתאמן עד שלוחצים על \"שמור ופרסם למתאמן\"."}
                </div>

                <div className="rounded-2xl border border-dashed border-[#444933] bg-[#171a15] p-4">
                  <p className="mb-2 text-xs font-bold text-[#c3f400]">ייבוא תפריט מטקסט חופשי</p>
                  <p className="mb-2 text-xs text-[#8e9379]">הדבק תפריט כמו שאתה כותב אותו רגיל (עם ימים, ארוחות, "/" לחלופות) - הוא יפורק אוטומטית ויתווסף לימים המתאימים.</p>
                  <textarea
                    value={importText}
                    onChange={(event) => setImportText(event.target.value)}
                    placeholder={"לדוגמה:\nימים א-ד:\nארוחת בוקר: 3 ביצים, 2 פרוסות לחם\n..."}
                    rows={4}
                    className="w-full rounded-xl border border-[#444933] bg-[#10130f] px-3 py-2 text-sm text-white"
                  />
                  <button
                    type="button"
                    disabled={importLoading || !importText.trim()}
                    onClick={() => void importMenu()}
                    className="mt-2 w-full rounded-xl border border-[#c3f400]/30 bg-[#c3f400]/10 py-2 text-sm font-bold text-[#c3f400] disabled:opacity-40"
                  >
                    {importLoading ? "מפרק ובונה..." : "ייבא תפריט"}
                  </button>
                  {importError && <p className="mt-2 text-xs text-red-300">{importError}</p>}
                  {importNotFound.length > 0 && (
                    <p className="mt-2 text-xs text-amber-300">לא נמצאו במאגר צמרת (הוסף ידנית): {importNotFound.join(", ")}</p>
                  )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {DAYS.map((label, index) => <button key={label} type="button" onClick={() => { setActiveDay(index); setCopyTarget(index === 6 ? 0 : index + 1); }} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${activeDay === index ? "bg-[#c3f400] text-[#161e00]" : "border border-[#444933] bg-[#1e2020] text-[#c4c9ac]"}`}>{label}</button>)}
                </div>

                <div className="rounded-2xl border border-[#c3f400]/25 bg-[#c3f400]/8 p-4">
                  <div className="mb-3">
                    <p className="text-xs font-bold text-[#c3f400]">עוזר AI לבניית תפריט</p>
                    <h3 className="text-base font-bold text-white">בקש רעיון והוסף אותו לחלופה שבחרת</h3>
                  </div>
                  {dayOptions.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[#444933] p-3 text-sm text-[#8e9379]">כדי להשתמש בעוזר, הוסף קודם ארוחה ליום הזה.</p>
                  ) : (
                    <div className="space-y-3">
                      <select
                        value={coachAiTargetOption?.id ?? ""}
                        onChange={(event) => setCoachAiTargetOptionId(event.target.value)}
                        className="w-full rounded-xl border border-[#444933] bg-[#10130f] px-3 py-2 text-sm text-white"
                      >
                        {dayOptions.map(({ meal, option }) => (
                          <option key={option.id} value={option.id}>{meal.label} - {option.label}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <input
                          value={coachAiTargetOption ? aiQueries[coachAiTargetOption.id] ?? "" : ""}
                          onChange={(event) => coachAiTargetOption && setAiQueries((current) => ({ ...current, [coachAiTargetOption.id]: event.target.value }))}
                          onKeyDown={(event) => { if (event.key === "Enter" && coachAiTargetOption) { event.preventDefault(); void askAi(coachAiTargetOption.id); } }}
                          placeholder="לדוגמה: ארוחת ערב חלבון גבוהה עד 500 קלוריות"
                          className="min-w-0 flex-1 rounded-xl border border-[#444933] bg-[#10130f] px-3 py-2 text-sm text-white"
                        />
                        <button
                          type="button"
                          disabled={!coachAiTargetOption || aiLoading[coachAiTargetOption.id] || !aiQueries[coachAiTargetOption.id]?.trim()}
                          onClick={() => coachAiTargetOption && void askAi(coachAiTargetOption.id)}
                          className="shrink-0 rounded-xl border border-[#c3f400]/30 bg-[#c3f400]/10 px-4 py-2 text-sm font-bold text-[#c3f400] disabled:opacity-40"
                        >
                          {coachAiTargetOption && aiLoading[coachAiTargetOption.id] ? "חושב..." : "הצע לי"}
                        </button>
                      </div>
                      {coachAiTargetOption && aiError[coachAiTargetOption.id] && <p className="text-xs text-red-300">{aiError[coachAiTargetOption.id]}</p>}
                      {coachAiTargetOption && (aiSuggestions[coachAiTargetOption.id]?.length ?? 0) > 0 && (
                        <div className="space-y-2">
                          {aiSuggestions[coachAiTargetOption.id]?.map((suggestion) => (
                            <div key={suggestion.id} className="flex items-center gap-3 rounded-xl bg-[#171a15] p-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-white">{suggestion.name_he}</p>
                                <p className="text-xs text-[#8e9379]">{Math.round(suggestion.grams)} ג׳ · {Math.round(suggestion.calories)} קל׳ · {Math.round(suggestion.protein)} חלבון</p>
                              </div>
                              <button type="button" disabled={saving} onClick={() => void addAiSuggestion(coachAiTargetOption.id, suggestion)} className="shrink-0 text-sm font-bold text-[#c3f400]">+ הוסף</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[#444933] bg-[#171a15] p-4">
                  <div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-white">סה״כ ליום (כל האפשרויות)</span><span className="text-[#c3f400]">{Math.round(dayCalories)}{numericTarget > 0 ? ` / ${numericTarget}` : ""} קל׳</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#282a2b]"><div className="h-full rounded-full bg-[#c3f400]" style={{ width: `${targetProgress}%` }} /></div>
                </div>

                {(day?.meals ?? []).map((meal) => (
                  <div key={meal.id} className="rounded-2xl border border-[#33372b] bg-[#171a15] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <input
                        defaultValue={meal.label}
                        onBlur={(event) => { if (event.target.value.trim() !== meal.label) void renameMeal(meal.id, event.target.value); }}
                        className="flex-1 rounded-lg border border-transparent bg-transparent px-1 font-bold text-white hover:border-[#444933] focus:border-[#c3f400] focus:bg-[#10130f] focus:outline-none"
                      />
                      <button type="button" disabled={saving} onClick={() => void deleteMeal(meal.id)} className="text-sm text-red-300">מחק ארוחה</button>
                    </div>

                    {meal.options.map((option) => (
                      <div key={option.id} className="mb-3 rounded-xl border border-[#282b22] bg-[#10130f] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-[#c3f400]">{option.label}</span>
                          {meal.options.length > 1 && (
                            <button type="button" disabled={saving} onClick={() => void deleteOption(option.id)} className="text-xs text-red-300">הסר אפשרות</button>
                          )}
                        </div>
                        <div className="mb-3 space-y-2">
                          {option.items.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-[#171a15] p-3"><div className="min-w-0 flex-1"><p className="truncate font-medium text-white">{item.name_he}</p><p className="text-xs text-[#8e9379]">{Math.round(Number(item.grams))} ג׳ · {Math.round(Number(item.calories))} קל׳</p></div><button type="button" disabled={saving} onClick={() => void removeItem(item.id)} aria-label={`הסר ${item.name_he}`} className="text-sm text-red-300">הסר</button></div>)}
                          {!option.items.length && <p className="text-sm text-[#6e7564]">עוד לא נוספו מזונות</p>}
                        </div>
                        <div className="relative">
                          <input value={queries[option.id] ?? ""} onChange={(event) => void findFoods(option.id, event.target.value)} placeholder="חפש מזון בצמרת" className="w-full rounded-xl border border-[#444933] bg-[#171a15] px-3 py-2 text-sm text-white" />
                          {(suggestions[option.id]?.length ?? 0) > 0 && <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[#444933] bg-[#1e2020] shadow-xl">{suggestions[option.id]?.map((food) => <button key={food.id} type="button" onMouseDown={() => { setSelectedFoods((current) => ({ ...current, [option.id]: food })); setQueries((current) => ({ ...current, [option.id]: food.name_he })); setSuggestions((current) => ({ ...current, [option.id]: [] })); }} className="flex w-full justify-between px-3 py-2 text-right text-sm text-white hover:bg-[#c3f400]/10"><span>{food.name_he}</span><span className="text-xs text-[#8e9379]">{food.calories} קל׳/100ג׳</span></button>)}</div>}
                        </div>
                        <div className="mt-2 flex gap-2"><input type="number" min="1" max="5000" value={grams[option.id] ?? ""} onChange={(event) => setGrams((current) => ({ ...current, [option.id]: event.target.value }))} placeholder="100 גרם" className="w-28 rounded-xl border border-[#444933] bg-[#171a15] px-3 py-2 text-sm text-white" /><button type="button" disabled={saving || !selectedFoods[option.id]} onClick={() => void addFood(option.id)} className="flex-1 rounded-xl border border-[#c3f400]/30 bg-[#c3f400]/10 py-2 text-sm font-bold text-[#c3f400] disabled:opacity-40">+ הוסף מזון</button></div>

                        <div className="mt-3 rounded-xl border border-dashed border-[#33372b] p-3">
                          <div className="flex gap-2">
                            <input
                              value={aiQueries[option.id] ?? ""}
                              onChange={(event) => setAiQueries((current) => ({ ...current, [option.id]: event.target.value }))}
                              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void askAi(option.id); } }}
                              placeholder="תאר מה אתה מחפש (למשל: חלבון גבוה מתחת ל-400 קלוריות)"
                              className="min-w-0 flex-1 rounded-xl border border-[#444933] bg-[#10130f] px-3 py-2 text-sm text-white"
                            />
                            <button
                              type="button"
                              disabled={aiLoading[option.id] || !aiQueries[option.id]?.trim()}
                              onClick={() => void askAi(option.id)}
                              className="shrink-0 rounded-xl border border-[#c3f400]/30 bg-[#c3f400]/10 px-4 py-2 text-sm font-bold text-[#c3f400] disabled:opacity-40"
                            >
                              {aiLoading[option.id] ? "חושב..." : "הצע לי מ-AI"}
                            </button>
                          </div>
                          {aiError[option.id] && <p className="mt-2 text-xs text-red-300">{aiError[option.id]}</p>}
                          {(aiSuggestions[option.id]?.length ?? 0) > 0 && (
                            <div className="mt-2 space-y-2">
                              {aiSuggestions[option.id]?.map((suggestion) => (
                                <div key={suggestion.id} className="flex items-center gap-3 rounded-xl bg-[#171a15] p-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium text-white">{suggestion.name_he}</p>
                                    <p className="text-xs text-[#8e9379]">{Math.round(suggestion.grams)} ג׳ · {Math.round(suggestion.calories)} קל׳ · {Math.round(suggestion.protein)} חלבון</p>
                                  </div>
                                  <button type="button" disabled={saving} onClick={() => void addAiSuggestion(option.id, suggestion)} className="shrink-0 text-sm font-bold text-[#c3f400]">+ הוסף</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <button type="button" disabled={saving} onClick={() => void addOption(meal.id)} className="w-full rounded-xl border border-dashed border-[#444933] py-2 text-sm text-[#8e9379]">+ הוסף אפשרות חלופית לארוחה זו</button>
                  </div>
                ))}

                <div className="flex gap-2 rounded-2xl border border-dashed border-[#444933] p-3">
                  <input value={newMealLabel} onChange={(event) => setNewMealLabel(event.target.value)} placeholder="שם ארוחה חדשה (למשל: ארוחת ביניים)" className="min-w-0 flex-1 rounded-xl border border-[#444933] bg-[#1e2020] px-3 py-2 text-sm text-white" />
                  <button type="button" disabled={saving || !newMealLabel.trim()} onClick={() => void addMeal()} className="rounded-xl bg-[#c3f400]/10 border border-[#c3f400]/30 px-4 py-2 text-sm font-bold text-[#c3f400] disabled:opacity-40">+ הוסף ארוחה</button>
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-[#33372b] p-3"><select value={copyTarget} onChange={(event) => setCopyTarget(Number(event.target.value))} className="min-w-0 flex-1 rounded-xl border border-[#444933] bg-[#1e2020] px-3 py-2 text-white">{DAYS.map((label, index) => index !== activeDay && <option key={label} value={index}>העתק ליום {label}</option>)}</select><button type="button" disabled={saving || copyTarget === activeDay} onClick={() => void duplicateDay()} className="rounded-xl border border-[#444933] px-4 py-2 font-semibold text-[#c4c9ac]">העתק יום</button></div>
                {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
                {message && <p className="rounded-xl border border-[#c3f400]/30 bg-[#c3f400]/10 p-3 text-sm text-[#c3f400]">{message}</p>}
                <div className="grid grid-cols-2 gap-3 pb-6"><button type="button" disabled={saving} onClick={() => void savePlan("draft")} className="rounded-xl border border-[#444933] py-3 font-bold text-[#c4c9ac] disabled:opacity-50">שמור כטיוטה</button><button type="button" disabled={saving} onClick={() => void savePlan("published")} className="rounded-xl bg-[#c3f400] py-3 font-bold text-[#161e00] disabled:opacity-50">שמור ופרסם למתאמן</button></div>
              </>
            )}
            {error && !plan && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
          </div>
        )}
      </section>
  );

  if (embedded) return panel;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 p-0 sm:p-4" onClick={onClose}>
      {panel}
    </div>
  );
}
