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
  const [reminding, setReminding] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");

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
  const meals = day?.meals ?? [];

  const consumed = useMemo(() => meals.reduce((sum, meal) => {
    const chosen = meal.options.find((option) => option.id === meal.selected_option_id);
    return sum + (chosen?.items.reduce((itemSum, item) => itemSum + Number(item.calories || 0), 0) ?? 0);
  }, 0), [meals]);

  const target = Number(plan?.daily_calories_target || 0);
  const progress = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  const completedMeals = meals.filter((meal) => Boolean(meal.selected_option_id)).length;
  const pendingMeals = Math.max(0, meals.length - completedMeals);
  const remainingCalories = target > 0 ? Math.max(0, Math.round(target - consumed)) : null;
  const exceededCalories = target > 0 ? Math.max(0, Math.round(consumed - target)) : 0;

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

  const remindCoach = async () => {
    if (reminding) return;
    setReminding(true);
    setReminderMessage("");
    try {
      const response = await fetch("/api/client/coach-reminders", {
        method: "POST",
        headers: await withCsrf({ "Content-Type": "application/json" }),
        body: JSON.stringify({ kind: "menu" }),
      });
      if (!response.ok) throw new Error("לא הצלחנו לשלוח תזכורת");
      const data = await response.json();
      setReminderMessage(data.already_sent ? "כבר שלחת תזכורת למאמן היום" : "שלחנו תזכורת למאמן");
    } catch (cause) {
      setReminderMessage(cause instanceof Error ? cause.message : "לא הצלחנו לשלוח תזכורת");
    } finally {
      setReminding(false);
    }
  };

  if (loading) return <div className="skeleton h-80 rounded-3xl" />;
  if (error && !plan) return <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-center text-sm text-red-200">{error}</div>;
  if (!plan) {
    return (
      <div className="rounded-2xl border border-[#444933] bg-[#151814] px-6 py-16 text-center">
        <p className="font-semibold text-white">המאמן עדיין לא בנה לך תפריט</p>
        <p className="mt-2 text-sm text-[#8e9379]">כשהתפריט יפורסם הוא יופיע כאן.</p>
        <button type="button" onClick={() => void remindCoach()} disabled={reminding}
          className="mt-5 w-full rounded-xl bg-[#c3f400] px-4 py-3 text-sm font-black text-[#161e00] transition disabled:opacity-60">
          {reminding ? "שולח..." : "הזכר למאמן להעלות תפריט"}
        </button>
        {reminderMessage && <p className="mt-3 text-xs font-semibold text-[#c3f400]">{reminderMessage}</p>}
      </div>
    );
  }

  return (
    <section className="space-y-6" dir="rtl">
      <header className="relative overflow-hidden rounded-3xl border border-[#c3f400]/20 bg-[#121612] px-5 py-5 shadow-[0_20px_50px_-35px_rgba(195,244,0,0.7)]">
        <div className="pointer-events-none absolute -left-12 -top-16 h-40 w-40 rounded-full bg-[#c3f400]/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black tracking-[0.2em] text-[#c3f400]">התפריט שלי</p>
            <h2 className="mt-2 truncate text-2xl font-black text-white">{plan.title}</h2>
            <p className="mt-1 text-xs text-[#8e9379]">{DAYS[selectedDay]} · התוכנית שלך להיום</p>
            <div className="mt-4 flex items-center gap-2 text-xs">
              <span className="rounded-full border border-[#38bdf8]/30 bg-[#38bdf8]/10 px-2 py-1 font-bold text-[#7dd3fc]">
                {pendingMeals > 0 ? "מעקב יומי" : "היום הושלם"}
              </span>
              <span className="truncate text-[#c4c9ac]">{pendingMeals > 0 ? `${pendingMeals} ארוחות עדיין לא סומנו` : "כל הארוחות סומנו"}</span>
            </div>
          </div>
          <div className="shrink-0 text-left">
            <p className="text-3xl font-black leading-none text-[#c3f400]">{completedMeals}<span className="text-base text-[#8e9379]">/{meals.length}</span></p>
            <p className="mt-1 text-[10px] font-bold text-[#8e9379]">ארוחות הושלמו</p>
          </div>
        </div>

        <div className="relative mt-6 border-t border-white/10 pt-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-[#c4c9ac]">התקדמות קלורית</p>
              <p className="mt-1 text-2xl font-black text-white">{Math.round(consumed)} <span className="text-xs font-semibold text-[#8e9379]">מתוך {target || "-"} קל׳</span></p>
            </div>
            <span className="text-lg font-black text-[#c3f400]">{progress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#2b3029]">
            <div className="h-full rounded-full bg-[#c3f400] shadow-[0_0_16px_rgba(195,244,0,0.55)] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-[#8e9379]">
            {exceededCalories > 0 ? `עברת את היעד ב־${exceededCalories} קל׳` : remainingCalories !== null ? `נשארו ${remainingCalories} קל׳ עד היעד` : "היעד היומי עדיין לא הוגדר"}
          </p>
        </div>
      </header>

      <nav aria-label="בחירת יום" className="space-y-2">
        <p className="px-1 text-[11px] font-bold text-[#8e9379]">בחר יום</p>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((label, index) => (
            <button key={label} type="button" onClick={() => setSelectedDay(index)}
              className={`w-full rounded-full border px-1 py-2 text-xs font-bold transition ${selectedDay === index ? "border-[#c3f400] bg-[#c3f400] text-[#161e00] shadow-[0_8px_24px_-12px_rgba(195,244,0,0.8)]" : "border-[#444933] bg-[#171a17] text-[#9da58c] hover:border-[#c3f400]/40 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}

      {!day || meals.length === 0 ? (
        <div className="rounded-2xl border border-[#33372b] bg-[#151814] p-8 text-center text-sm text-[#6e7564]">אין ארוחות מתוכננות ליום הזה</div>
      ) : (
        <div className="relative space-y-4">
          <div className="pointer-events-none absolute bottom-6 right-[13px] top-6 w-px bg-gradient-to-b from-[#c3f400]/50 via-[#444933] to-transparent" />
          {meals.map((meal, mealIndex) => {
            const hasMultipleOptions = meal.options.length > 1;
            return (
              <article key={meal.id} className="relative pr-9">
                <div className={`absolute right-0 top-5 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-black ${meal.selected_option_id ? "border-[#c3f400] bg-[#c3f400] text-[#161e00]" : "border-[#444933] bg-[#111413] text-[#8e9379]"}`}>
                  {meal.selected_option_id ? "✓" : mealIndex + 1}
                </div>
                <div className={`overflow-hidden rounded-2xl border transition ${meal.selected_option_id ? "border-[#c3f400]/30 bg-[#182015]" : "border-[#33372b] bg-[#151814]"}`}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <h3 className="font-black text-white">{meal.label}</h3>
                    {meal.selected_option_id && <span className="text-[10px] font-bold text-[#c3f400]">נאכל</span>}
                  </div>
                  <div className="px-3 pb-3">
                    {meal.options.map((option) => {
                      const isSelected = meal.selected_option_id === option.id;
                      const optionCalories = option.items.reduce((sum, item) => sum + Number(item.calories || 0), 0);
                      return (
                        <div key={option.id} className={`border-t border-white/10 px-1 py-3 ${isSelected ? "text-white" : "text-[#9da58c]"}`}>
                          <button type="button" aria-label={`${isSelected ? "סומן כאכלתי" : "סמן כאכלתי"}${hasMultipleOptions ? `: ${option.label}` : ""}`} aria-pressed={isSelected} disabled={savingMealId === meal.id} onClick={() => void selectOption(meal.id, option.id, isSelected)}
                            className="flex w-full items-center justify-between gap-3 text-right transition hover:text-white">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-[#c3f400] bg-[#c3f400]" : "border-[#444933]"}`}>
                                {isSelected && <span className="text-xs font-black text-[#161e00]">✓</span>}
                              </span>
                              {hasMultipleOptions && <span className={`truncate text-xs font-bold ${isSelected ? "text-[#c3f400]" : "text-[#c4c9ac]"}`}>{option.label}</span>}
                            </span>
                            <span className="shrink-0 text-xs font-semibold text-[#8e9379]">{Math.round(optionCalories)} קל׳</span>
                          </button>
                          <div className="mt-2 space-y-1 pr-7">
                            {option.items.map((item) => (
                              <p key={item.id} className="flex items-start gap-2 text-sm leading-relaxed">
                                <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? "bg-[#c3f400]" : "bg-[#59614f]"}`} />
                                <span>{item.name_he} <span className="text-xs text-[#6e7564]">· {Math.round(Number(item.grams))} ג׳</span></span>
                              </p>
                            ))}
                            {!option.items.length && <p className="text-sm text-[#6e7564]">אין פריטים באפשרות זו</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
