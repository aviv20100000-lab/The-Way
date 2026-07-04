"use client";

import { useState } from "react";

export interface Meal {
  id: string;
  total_calories: number;
  logged_at: string;
  source?: "ai" | "quick";
  items: {
    name?: unknown;
    calories?: unknown;
    estimated_weight_g?: unknown;
    protein?: unknown;
    protein_g?: unknown;
  }[];
}

const toDate = (s: string) => new Date(s.replace(" ", "T") + (s.includes("T") ? "" : "Z"));
const dayKeyOf = (s: string) => toDate(s).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

function safeNumber(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function proteinOf(item: Meal["items"][number]) {
  return safeNumber(item.protein_g) ?? safeNumber(item.protein);
}

export default function MealHistory({
  meals,
  title = "המעקב שלי",
  loading,
  onDelete,
  compact = false,
  maxDays = 3,
  onShowAll,
}: {
  meals: Meal[];
  title?: string;
  loading?: boolean;
  onDelete?: (id: string, source?: "ai" | "quick") => void;
  compact?: boolean;
  maxDays?: number;
  onShowAll?: () => void;
}) {
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-[#1e2020] animate-pulse" />
        ))}
      </div>
    );
  }

  if (meals.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-[#444933] p-6 text-center">
        <p className="text-sm text-[#8e9379]">לא שמרת ארוחות עדיין</p>
        <p className="text-xs text-[#8e9379] mt-1">שמור ארוחה למעלה כדי לעקוב</p>
      </div>
    );
  }

  const byDay: Record<string, { total: number; meals: Meal[] }> = {};
  for (const m of meals) {
    const k = dayKeyOf(m.logged_at);
    (byDay[k] ??= { total: 0, meals: [] });
    byDay[k].total += m.total_calories || 0;
    byDay[k].meals.push(m);
  }
  const dayKeys = Object.keys(byDay).sort((a, b) => b.localeCompare(a));
  const visibleDayKeys = compact ? dayKeys.slice(0, maxDays) : dayKeys;

  const pad = (n: number) => String(n).padStart(2, "0");
  const weekStartOf = (ymd: string) => {
    const d = new Date(ymd + "T00:00:00");
    d.setDate(d.getDate() - d.getDay());
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const byWeek: Record<string, { total: number; days: Set<string> }> = {};
  for (const k of dayKeys) {
    const wk = weekStartOf(k);
    (byWeek[wk] ??= { total: 0, days: new Set() });
    byWeek[wk].total += byDay[k].total;
    byWeek[wk].days.add(k);
  }
  const weekKeys = Object.keys(byWeek).sort((a, b) => b.localeCompare(a));

  const byMonth: Record<string, { total: number; days: Set<string> }> = {};
  for (const k of dayKeys) {
    const mk = k.slice(0, 7);
    (byMonth[mk] ??= { total: 0, days: new Set() });
    byMonth[mk].total += byDay[k].total;
    byMonth[mk].days.add(k);
  }
  const monthKeys = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

  const dayLabel = (ymd: string) =>
    new Date(ymd + "T00:00:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric" });
  const weekLabel = (start: string) => {
    const s = new Date(start + "T00:00:00");
    const e = new Date(s); e.setDate(s.getDate() + 6);
    const f = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
    return `${f(s)} – ${f(e)}`;
  };
  const monthLabel = (ym: string) =>
    new Date(ym + "-01T00:00:00").toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">{title}</p>
        {!compact && <div className="flex rounded-xl bg-[#1e2020] border border-[#444933] p-1 text-xs gap-0.5">
          {([["day", "יומי"], ["week", "שבועי"], ["month", "חודשי"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-3 py-1 font-medium transition-all ${
                view === v ? "bg-[#c3f400] text-[#161e00]" : "text-[#8e9379] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>}
      </div>

      {view === "day" && visibleDayKeys.map((k) => {
        const isExp = expanded === k;
        const proteinValues = byDay[k].meals.flatMap((meal) => meal.items.map(proteinOf)).filter((value): value is number => value !== null);
        const proteinTotal = proteinValues.reduce((sum, value) => sum + value, 0);
        return (
          <div key={k} className="glass-card rounded-2xl border border-[#444933] overflow-hidden">
            <button className="w-full text-right px-4 py-3" onClick={() => setExpanded(isExp ? null : k)}>
              <div className="flex items-center justify-between">
                <div className="text-right">
                  <p className="font-semibold text-white text-sm">{dayLabel(k)}</p>
                  <p className="text-xs text-[#8e9379]">{byDay[k].meals.length} ארוחות</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#c3f400]">{byDay[k].total} קל׳</span>
                  <span className="text-[#8e9379] text-xs">{isExp ? "▲" : "▼"}</span>
                </div>
              </div>
            </button>
            {isExp && (
              <div className="border-t border-[#444933] px-4 pb-4 pt-3 space-y-3">
                <p className="text-xs text-[#8e9379]">
                  {byDay[k].meals.length} ארוחות · {byDay[k].total} קל׳
                  {proteinValues.length > 0 && ` · ${Math.round(proteinTotal)} גרם חלבון`}
                </p>
                {byDay[k].meals.map((m) => (
                  <div key={m.id} className="rounded-xl border border-[#444933] bg-[#242727] p-3">
                    <div className="flex items-center justify-between gap-3 border-b border-[#444933]/70 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#8e9379]">
                          {toDate(m.logged_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })}
                        </span>
                        {m.source === "quick" && (
                          <span className="text-[10px] bg-[#282a2b] border border-[#444933] rounded px-1 text-[#8e9379]">מהיר</span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-[#c3f400]">{Math.round(Number(m.total_calories) || 0)} קל׳</span>
                        {onDelete && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(m.id, m.source); }}
                            className="p-1 text-xs text-red-400 transition-colors hover:text-red-300"
                            aria-label="מחק ארוחה"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 space-y-2">
                      {m.items.map((item, index) => {
                        const name = typeof item.name === "string" && item.name.trim() ? item.name : "פריט";
                        const grams = Math.round(safeNumber(item.estimated_weight_g) ?? 0);
                        const calories = Math.round(safeNumber(item.calories) ?? 0);
                        const protein = proteinOf(item);
                        return (
                          <div key={`${m.id}-${index}`} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-xs">
                            <span className="min-w-0 flex-1 whitespace-normal break-words text-[#c4c9ac]">{name}</span>
                            <span className="text-left text-[#8e9379]">
                              {grams} גרם · {calories} קל׳
                              {protein !== null && ` · ${Math.round(protein)} חלבון`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {view === "week" && weekKeys.map((k) => (
        <div key={k} className="glass-card rounded-2xl border border-[#444933] p-4 flex items-center justify-between">
          <div className="text-right">
            <p className="font-semibold text-white text-sm">שבוע {weekLabel(k)}</p>
            <p className="text-xs text-[#8e9379]">ממוצע {Math.round(byWeek[k].total / byWeek[k].days.size)} קל׳/יום · {byWeek[k].days.size} ימים</p>
          </div>
          <span className="font-bold text-[#c3f400]">{byWeek[k].total} קל׳</span>
        </div>
      ))}

      {view === "month" && monthKeys.map((k) => (
        <div key={k} className="glass-card rounded-2xl border border-[#444933] p-4 flex items-center justify-between">
          <div className="text-right">
            <p className="font-semibold text-white text-sm">{monthLabel(k)}</p>
            <p className="text-xs text-[#8e9379]">ממוצע {Math.round(byMonth[k].total / byMonth[k].days.size)} קל׳/יום · {byMonth[k].days.size} ימים</p>
          </div>
          <span className="font-bold text-[#c3f400]">{byMonth[k].total} קל׳</span>
        </div>
      ))}

      {compact && onShowAll && (
        <button type="button" onClick={onShowAll} className="w-full rounded-xl border border-[#444933] py-2.5 text-sm font-semibold text-[#c3f400] transition-colors hover:bg-[#c3f400]/5">
          לכל ההיסטוריה
        </button>
      )}
    </div>
  );
}
