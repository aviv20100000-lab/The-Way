"use client";

import { useState } from "react";

export interface Meal {
  id: string;
  total_calories: number;
  logged_at: string;
  items: { name: string; calories: number; estimated_weight_g: number }[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const toDate = (s: string) => new Date(s.replace(" ", "T") + "Z");
const dayKeyOf = (s: string) => toDate(s).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

export default function MealHistory({ meals, title = "המעקב שלי" }: { meals: Meal[]; title?: string }) {
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [expanded, setExpanded] = useState<string | null>(null);

  if (meals.length === 0) {
    return <p className="text-sm text-gray-400">אין ארוחות שמורות</p>;
  }

  // Group by Israel-local calendar day
  const byDay: Record<string, { total: number; meals: Meal[] }> = {};
  for (const m of meals) {
    const k = dayKeyOf(m.logged_at);
    (byDay[k] ??= { total: 0, meals: [] });
    byDay[k].total += m.total_calories || 0;
    byDay[k].meals.push(m);
  }
  const dayKeys = Object.keys(byDay).sort((a, b) => b.localeCompare(a));

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
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className="flex rounded-xl bg-gray-100 p-1 text-xs">
          {([["day", "יומי"], ["week", "שבועי"], ["month", "חודשי"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${view === v ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "day" && dayKeys.map((k) => {
        const isExp = expanded === k;
        return (
          <div key={k} className="rounded-2xl bg-white shadow-sm overflow-hidden">
            <button className="w-full text-right p-4" onClick={() => setExpanded(isExp ? null : k)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{dayLabel(k)}</p>
                  <p className="text-xs text-gray-400">{byDay[k].meals.length} ארוחות</p>
                </div>
                <span className="font-bold text-orange-500">{byDay[k].total} קל'</span>
              </div>
              {isExp && (
                <div className="mt-3 border-t pt-3 space-y-2">
                  {byDay[k].meals.map((m) => (
                    <div key={m.id}>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{toDate(m.logged_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })}</span>
                        <span className="font-medium text-orange-500">{m.total_calories} קל'</span>
                      </div>
                      <p className="text-xs text-gray-400">{m.items.map((it) => it.name).join(" · ")}</p>
                    </div>
                  ))}
                </div>
              )}
            </button>
          </div>
        );
      })}

      {view === "week" && weekKeys.map((k) => (
        <div key={k} className="rounded-2xl bg-white shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-800">שבוע {weekLabel(k)}</p>
            <p className="text-xs text-gray-400">ממוצע {Math.round(byWeek[k].total / byWeek[k].days.size)} קל'/יום · {byWeek[k].days.size} ימים</p>
          </div>
          <span className="font-bold text-orange-500">{byWeek[k].total} קל'</span>
        </div>
      ))}

      {view === "month" && monthKeys.map((k) => (
        <div key={k} className="rounded-2xl bg-white shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-800">{monthLabel(k)}</p>
            <p className="text-xs text-gray-400">ממוצע {Math.round(byMonth[k].total / byMonth[k].days.size)} קל'/יום · {byMonth[k].days.size} ימים</p>
          </div>
          <span className="font-bold text-orange-500">{byMonth[k].total} קל'</span>
        </div>
      ))}
    </div>
  );
}
