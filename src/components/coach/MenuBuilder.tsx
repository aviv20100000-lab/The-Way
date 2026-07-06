"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { withCsrf } from "@/lib/csrf-client";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type FoodSuggestion = { id: string; name_he: string; calories: number };
type MenuItem = { id: string; name_he: string; grams: number; calories: number };
type MenuMeal = { id: string; meal_type: MealType; items: MenuItem[] };
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
const MEALS: Array<{ type: MealType; label: string }> = [
  { type: "breakfast", label: "בוקר" },
  { type: "lunch", label: "צהריים" },
  { type: "dinner", label: "ערב" },
  { type: "snack", label: "נשנוש" },
];

export default function MenuBuilder({ client, onClose }: { client: { id: string; name: string }; onClose: () => void }) {
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
  const [queries, setQueries] = useState<Partial<Record<MealType, string>>>({});
  const [grams, setGrams] = useState<Partial<Record<MealType, string>>>({});
  const [suggestions, setSuggestions] = useState<Partial<Record<MealType, FoodSuggestion[]>>>({});
  const [selectedFoods, setSelectedFoods] = useState<Partial<Record<MealType, FoodSuggestion>>>({});

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
  const dayCalories = useMemo(
    () => day?.meals.flatMap((meal) => meal.items).reduce((sum, item) => sum + Number(item.calories || 0), 0) ?? 0,
    [day]
  );
  const numericTarget = Number(caloriesTarget || 0);
  const targetProgress = numericTarget > 0 ? Math.min(100, Math.round((dayCalories / numericTarget) * 100)) : 0;

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

  const findFoods = async (mealType: MealType, query: string) => {
    setQueries((current) => ({ ...current, [mealType]: query }));
    setSelectedFoods((current) => ({ ...current, [mealType]: undefined }));
    if (query.trim().length < 2) {
      setSuggestions((current) => ({ ...current, [mealType]: [] }));
      return;
    }
    try {
      const response = await fetch(`/api/foods?q=${encodeURIComponent(query)}`);
      const data: FoodSuggestion[] = await response.json();
      setSuggestions((current) => ({ ...current, [mealType]: Array.isArray(data) ? data.filter((food) => food.id.startsWith("tz-")).slice(0, 6) : [] }));
    } catch {
      setSuggestions((current) => ({ ...current, [mealType]: [] }));
    }
  };

  const addFood = async (mealType: MealType) => {
    const food = selectedFoods[mealType];
    const amount = Number(grams[mealType] || 100);
    if (!plan || !day || !food || !Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/coach/menus/${plan.id}/items`, {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ dayId: day.id, mealType, tzameretCode: food.id, grams: amount }),
      });
      if (!response.ok) throw new Error("הוספת המזון נכשלה");
      await loadPlan(plan.id);
      setQueries((current) => ({ ...current, [mealType]: "" }));
      setGrams((current) => ({ ...current, [mealType]: "" }));
      setSuggestions((current) => ({ ...current, [mealType]: [] }));
      setSelectedFoods((current) => ({ ...current, [mealType]: undefined }));
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

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <section dir="rtl" className="mx-auto h-full max-w-3xl overflow-y-auto bg-[#10130f] p-4 sm:rounded-3xl sm:border sm:border-[#444933] sm:p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div><p className="text-xs font-bold text-[#c3f400]">בניית תפריט</p><h2 className="text-xl font-black text-white">{client.name}</h2></div>
          <button type="button" onClick={onClose} aria-label="סגור" className="rounded-full border border-[#444933] px-3 py-1.5 text-xl text-[#c4c9ac]">×</button>
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
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {DAYS.map((label, index) => <button key={label} type="button" onClick={() => { setActiveDay(index); setCopyTarget(index === 6 ? 0 : index + 1); }} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${activeDay === index ? "bg-[#c3f400] text-[#161e00]" : "border border-[#444933] bg-[#1e2020] text-[#c4c9ac]"}`}>{label}</button>)}
                </div>

                <div className="rounded-2xl border border-[#444933] bg-[#171a15] p-4">
                  <div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-white">סה״כ ליום</span><span className="text-[#c3f400]">{Math.round(dayCalories)}{numericTarget > 0 ? ` / ${numericTarget}` : ""} קל׳</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#282a2b]"><div className="h-full rounded-full bg-[#c3f400]" style={{ width: `${targetProgress}%` }} /></div>
                </div>

                {MEALS.map(({ type, label }) => {
                  const meal = day?.meals.find((entry) => entry.meal_type === type);
                  return (
                    <div key={type} className="rounded-2xl border border-[#33372b] bg-[#171a15] p-4">
                      <h3 className="mb-3 font-bold text-white">{label}</h3>
                      <div className="mb-3 space-y-2">
                        {meal?.items.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-[#10130f] p-3"><div className="min-w-0 flex-1"><p className="truncate font-medium text-white">{item.name_he}</p><p className="text-xs text-[#8e9379]">{Math.round(Number(item.grams))} ג׳ · {Math.round(Number(item.calories))} קל׳</p></div><button type="button" disabled={saving} onClick={() => void removeItem(item.id)} aria-label={`הסר ${item.name_he}`} className="text-sm text-red-300">הסר</button></div>)}
                        {!meal?.items.length && <p className="text-sm text-[#6e7564]">עוד לא נוספו מזונות</p>}
                      </div>
                      <div className="relative">
                        <input value={queries[type] ?? ""} onChange={(event) => void findFoods(type, event.target.value)} placeholder="חפש מזון בצמרת" className="w-full rounded-xl border border-[#444933] bg-[#10130f] px-3 py-2 text-sm text-white" />
                        {(suggestions[type]?.length ?? 0) > 0 && <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[#444933] bg-[#1e2020] shadow-xl">{suggestions[type]?.map((food) => <button key={food.id} type="button" onMouseDown={() => { setSelectedFoods((current) => ({ ...current, [type]: food })); setQueries((current) => ({ ...current, [type]: food.name_he })); setSuggestions((current) => ({ ...current, [type]: [] })); }} className="flex w-full justify-between px-3 py-2 text-right text-sm text-white hover:bg-[#c3f400]/10"><span>{food.name_he}</span><span className="text-xs text-[#8e9379]">{food.calories} קל׳/100ג׳</span></button>)}</div>}
                      </div>
                      <div className="mt-2 flex gap-2"><input type="number" min="1" max="5000" value={grams[type] ?? ""} onChange={(event) => setGrams((current) => ({ ...current, [type]: event.target.value }))} placeholder="100 גרם" className="w-28 rounded-xl border border-[#444933] bg-[#10130f] px-3 py-2 text-sm text-white" /><button type="button" disabled={saving || !selectedFoods[type]} onClick={() => void addFood(type)} className="flex-1 rounded-xl border border-[#c3f400]/30 bg-[#c3f400]/10 py-2 text-sm font-bold text-[#c3f400] disabled:opacity-40">+ הוסף מזון</button></div>
                    </div>
                  );
                })}

                <div className="flex items-center gap-2 rounded-2xl border border-[#33372b] p-3"><select value={copyTarget} onChange={(event) => setCopyTarget(Number(event.target.value))} className="min-w-0 flex-1 rounded-xl border border-[#444933] bg-[#1e2020] px-3 py-2 text-white">{DAYS.map((label, index) => index !== activeDay && <option key={label} value={index}>העתק ליום {label}</option>)}</select><button type="button" disabled={saving || copyTarget === activeDay} onClick={() => void duplicateDay()} className="rounded-xl border border-[#444933] px-4 py-2 font-semibold text-[#c4c9ac]">העתק יום</button></div>
                {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
                {message && <p className="rounded-xl border border-[#c3f400]/30 bg-[#c3f400]/10 p-3 text-sm text-[#c3f400]">{message}</p>}
                <div className="grid grid-cols-2 gap-3 pb-6"><button type="button" disabled={saving} onClick={() => void savePlan("draft")} className="rounded-xl border border-[#444933] py-3 font-bold text-[#c4c9ac] disabled:opacity-50">שמור טיוטה</button><button type="button" disabled={saving} onClick={() => void savePlan("published")} className="rounded-xl bg-[#c3f400] py-3 font-bold text-[#161e00] disabled:opacity-50">פרסם ללקוח</button></div>
              </>
            )}
            {error && !plan && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
