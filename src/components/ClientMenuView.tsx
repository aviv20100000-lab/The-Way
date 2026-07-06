"use client";

import { useEffect, useMemo, useState } from "react";
import { withCsrf } from "@/lib/csrf-client";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type MenuItem = { id: string; name_he: string; grams: number; calories: number; checked: number | boolean; checked_at: string | null };
type MenuMeal = { id: string; meal_type: MealType; items: MenuItem[] };
type MenuDay = { id: string; day_index: number; meals: MenuMeal[] };
type MenuPlan = { id: string; title: string; daily_calories_target: number | null; days: MenuDay[] };

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MEALS: Array<{ type: MealType; label: string }> = [
  { type: "breakfast", label: "בוקר" },
  { type: "lunch", label: "צהריים" },
  { type: "dinner", label: "ערב" },
  { type: "snack", label: "נשנוש" },
];

export default function ClientMenuView() {
  const [plan, setPlan] = useState<MenuPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/menus/current", { cache: "no-store" });
        if (!response.ok) throw new Error("לא ניתן לטעון את התפריט");
        const data = await response.json();
        if (active) setPlan(data);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "לא ניתן לטעון את התפריט");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const day = plan?.days.find((entry) => Number(entry.day_index) === selectedDay);
  const items = useMemo(() => day?.meals.flatMap((meal) => meal.items) ?? [], [day]);
  const consumed = items.filter((item) => Boolean(item.checked)).reduce((sum, item) => sum + Number(item.calories || 0), 0);
  const target = Number(plan?.daily_calories_target || 0);
  const progress = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;

  const toggleItem = async (itemId: string, checked: boolean) => {
    if (!plan || savingItemId) return;
    const previous = plan;
    setSavingItemId(itemId);
    setPlan({
      ...plan,
      days: plan.days.map((entry) => ({
        ...entry,
        meals: entry.meals.map((meal) => ({
          ...meal,
          items: meal.items.map((item) => item.id === itemId ? { ...item, checked, checked_at: checked ? new Date().toISOString() : null } : item),
        })),
      })),
    });
    try {
      const response = await fetch(`/api/menus/items/${itemId}/check`, {
        method: "PATCH",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ checked }),
      });
      if (!response.ok) throw new Error("שמירת הסימון נכשלה");
    } catch (cause) {
      setPlan(previous);
      setError(cause instanceof Error ? cause.message : "שמירת הסימון נכשלה");
    } finally {
      setSavingItemId(null);
    }
  };

  if (loading) return <div className="skeleton h-80 rounded-3xl" />;
  if (error && !plan) return <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-center text-sm text-red-200">{error}</div>;
  if (!plan) {
    return (
      <div className="glass-card rounded-3xl border border-[#444933] px-6 py-16 text-center">
        <div className="mb-3 text-4xl">🍽️</div>
        <p className="font-semibold text-white">המאמן עדיין לא בנה לך תפריט</p>
        <p className="mt-2 text-sm text-[#8e9379]">כשהתפריט יפורסם הוא יופיע כאן.</p>
      </div>
    );
  }

  return (
    <section className="space-y-4" dir="rtl">
      <div>
        <p className="text-xs font-bold tracking-widest text-[#c3f400]">התפריט שלי</p>
        <h2 className="mt-1 text-2xl font-black text-white">{plan.title}</h2>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map((label, index) => (
          <button key={label} type="button" onClick={() => setSelectedDay(index)}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition ${selectedDay === index ? "bg-[#c3f400] text-[#161e00]" : "border border-[#444933] bg-[#1e2020] text-[#c4c9ac]"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl border border-[#444933] p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-white">סומן היום</span>
          <span className="text-[#c3f400]">{Math.round(consumed)}{target > 0 ? ` / ${target}` : ""} קל׳</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#282a2b]">
          <div className="h-full rounded-full bg-[#c3f400] transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}

      {MEALS.map(({ type, label }) => {
        const meal = day?.meals.find((entry) => entry.meal_type === type);
        return (
          <div key={type} className="glass-card rounded-2xl border border-[#33372b] p-4">
            <h3 className="mb-3 font-bold text-white">{label}</h3>
            {!meal || meal.items.length === 0 ? (
              <p className="text-sm text-[#6e7564]">אין פריטים בארוחה הזו</p>
            ) : (
              <div className="space-y-2">
                {meal.items.map((item) => {
                  const checked = Boolean(item.checked);
                  return (
                    <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${checked ? "border-[#c3f400]/30 bg-[#c3f400]/10" : "border-[#33372b] bg-[#151814]"}`}>
                      <input type="checkbox" checked={checked} disabled={savingItemId === item.id}
                        onChange={(event) => void toggleItem(item.id, event.target.checked)}
                        className="h-5 w-5 accent-[#c3f400]" />
                      <span className={`min-w-0 flex-1 font-medium ${checked ? "text-[#c4c9ac] line-through" : "text-white"}`}>{item.name_he}</span>
                      <span className="shrink-0 text-xs text-[#8e9379]">{Math.round(Number(item.grams))} ג׳ · {Math.round(Number(item.calories))} קל׳</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
