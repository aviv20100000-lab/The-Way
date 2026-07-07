"use client";

import { useEffect, useMemo, useState } from "react";
import { withCsrf } from "@/lib/csrf-client";

type MenuItem = { id: string; name_he: string; grams: number; calories: number };
type MenuOption = { id: string; menu_meal_id: string; label: string; sort_order: number; items: MenuItem[] };
type MenuMeal = { id: string; menu_day_id: string; label: string; sort_order: number; selected_option_id: string | null; options: MenuOption[] };
type MenuDay = { id: string; day_index: number; meals: MenuMeal[] };
type MenuPlan = { id: string; title: string; daily_calories_target: number | null; days: MenuDay[] };

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export default function ClientMenuView() {
  const [plan, setPlan] = useState<MenuPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingMealId, setSavingMealId] = useState<string | null>(null);

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

  const consumed = useMemo(() => {
    if (!day) return 0;
    return day.meals.reduce((sum, meal) => {
      const chosen = meal.options.find((option) => option.id === meal.selected_option_id);
      const mealCalories = chosen?.items.reduce((itemSum, item) => itemSum + Number(item.calories || 0), 0) ?? 0;
      return sum + mealCalories;
    }, 0);
  }, [day]);

  const target = Number(plan?.daily_calories_target || 0);
  const progress = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;

  const selectOption = async (mealId: string, optionId: string, alreadySelected: boolean) => {
    if (!plan || savingMealId) return;
    const nextOptionId = alreadySelected ? null : optionId;
    const previous = plan;
    setSavingMealId(mealId);
    setPlan({
      ...plan,
      days: plan.days.map((entry) => ({
        ...entry,
        meals: entry.meals.map((meal) => meal.id === mealId ? { ...meal, selected_option_id: nextOptionId } : meal),
      })),
    });
    try {
      const response = await fetch(`/api/menus/meals/${mealId}/select`, {
        method: "PATCH",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ optionId: nextOptionId }),
      });
      if (!response.ok) throw new Error("שמירת הבחירה נכשלה");
    } catch (cause) {
      setPlan(previous);
      setError(cause instanceof Error ? cause.message : "שמירת הבחירה נכשלה");
    } finally {
      setSavingMealId(null);
    }
  };

  if (loading) return <div className="skeleton h-80 rounded-3xl" />;
  if (error && !plan) return <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-center text-sm text-red-200">{error}</div>;
  if (!plan) {
    return (
      <div className="glass-card rounded-3xl border border-[#444933] px-6 py-16 text-center">
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

      {!day || day.meals.length === 0 ? (
        <div className="glass-card rounded-2xl border border-[#33372b] p-6 text-center text-sm text-[#6e7564]">אין ארוחות מתוכננות ליום הזה</div>
      ) : (
        day.meals.map((meal) => {
          const hasMultipleOptions = meal.options.length > 1;
          return (
            <div key={meal.id} className="glass-card rounded-2xl border border-[#33372b] p-4">
              <h3 className="mb-3 font-bold text-white">{meal.label}</h3>
              <div className="space-y-2">
                {meal.options.map((option) => {
                  const isSelected = meal.selected_option_id === option.id;
                  const optionCalories = option.items.reduce((sum, item) => sum + Number(item.calories || 0), 0);
                  return (
                    <div key={option.id} className={`rounded-xl border p-3 transition ${isSelected ? "border-[#c3f400]/40 bg-[#c3f400]/10" : "border-[#33372b] bg-[#151814]"}`}>
                      <button
                        type="button"
                        disabled={savingMealId === meal.id}
                        onClick={() => void selectOption(meal.id, option.id, isSelected)}
                        className="flex w-full items-center justify-between gap-3 text-right"
                      >
                        <span className="flex items-center gap-2">
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-[#c3f400] bg-[#c3f400]" : "border-[#444933]"}`}>
                            {isSelected && <span className="text-xs font-black text-[#161e00]">✓</span>}
                          </span>
                          {hasMultipleOptions && <span className="text-xs font-bold text-[#c3f400]">{option.label} ·</span>}
                        </span>
                        <span className="text-xs text-[#8e9379]">{Math.round(optionCalories)} קל׳</span>
                      </button>
                      <div className="mt-2 space-y-1 pr-7">
                        {option.items.map((item) => (
                          <p key={item.id} className={`text-sm ${isSelected ? "text-white" : "text-[#8e9379]"}`}>
                            {item.name_he} <span className="text-xs text-[#6e7564]">· {Math.round(Number(item.grams))} ג׳</span>
                          </p>
                        ))}
                        {!option.items.length && <p className="text-sm text-[#6e7564]">אין פריטים באפשרות זו</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
