"use client";

import { useState } from "react";

interface DailySummaryItem {
  client_id: string;
  client_name: string;
  reported: boolean;
  calories: number;
  calorie_goal: number | null;
  water_ml: number;
  water_goal: number;
  steps: number;
  steps_goal: number | null;
  weight_kg: number | null;
  flags: string[];
}

const NO_REPORT_FLAG = "לא דיווח";
const WATER_GOAL_FLAG = "יעד מים הושג";
const STEPS_GOAL_FLAG = "יעד צעדים הושג";
const CALORIE_OVER_FLAG = "חריגה מיעד קלוריות";

function getYesterdayLabel() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(yesterday);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${day}.${month}`;
}

function getYesterdayDayKey() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(yesterday);
}

function flagClass(flag: string) {
  if (flag === NO_REPORT_FLAG) {
    return "border border-red-500/30 bg-red-500/10 text-red-200";
  }

  if (flag === WATER_GOAL_FLAG || flag === STEPS_GOAL_FLAG) {
    return "border border-[#c3f400]/30 bg-[#c3f400]/10 text-[#d7ff52]";
  }

  if (flag === CALORIE_OVER_FLAG) {
    return "border border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return "border border-[#444933] bg-[#242727] text-[#c4c9ac]";
}

function formatGoal(actual: number, goal: number | null, suffix = "") {
  if (goal === null) return `${actual.toLocaleString("he-IL")}${suffix}`;
  return `${actual.toLocaleString("he-IL")} / ${goal.toLocaleString("he-IL")}${suffix}`;
}

export default function CoachDailySummary() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DailySummaryItem[]>([]);
  const [error, setError] = useState("");

  const dayKey = getYesterdayDayKey();

  async function loadSummary(force = false) {
    if (loading) return;
    if (loaded && !force) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/coach/daily-summary?day=${dayKey}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "לא הצלחנו לטעון את הסיכום");
        return;
      }
      setItems(Array.isArray(data) ? data : []);
      setLoaded(true);
    } catch {
      setError("לא הצלחנו לטעון את הסיכום");
    } finally {
      setLoading(false);
    }
  }

  async function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && !loaded) {
      await loadSummary(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#3c4721] bg-[linear-gradient(180deg,rgba(30,34,26,0.92),rgba(14,16,15,0.96))] shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right"
      >
        <div>
          <p className="text-lg font-semibold text-white">סיכום יומי - אתמול ({getYesterdayLabel()})</p>
          <p className="mt-1 text-xs text-[#9aa181]">תמונה מהירה של כל המתאמנים בלי לפתוח כל כרטיס</p>
        </div>
        <div className="flex items-center gap-2">
          {loaded && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void loadSummary(true);
              }}
              className="rounded-full border border-[#4a5530] px-3 py-1 text-xs font-semibold text-[#c3f400] hover:bg-[#c3f400]/10"
            >
              רענון
            </button>
          )}
          <span className="text-lg text-[#c3f400]">{open ? "▴" : "▾"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-[#394026] px-4 pb-4 pt-3">
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-[#1c1f1c]" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="rounded-2xl border border-[#444933] bg-[#181b19] px-4 py-4 text-sm text-[#c4c9ac]">
              אין כרגע מתאמנים להצגה.
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="space-y-2">
              {items.map((item) => {
                const otherFlags = item.flags.filter((flag) => flag !== NO_REPORT_FLAG);
                return (
                  <div key={item.client_id} className="rounded-2xl border border-[#444933] bg-[#181b19] px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{item.client_name}</p>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          item.reported
                            ? "border border-[#c3f400]/30 bg-[#c3f400]/10 text-[#d7ff52]"
                            : "border border-red-500/30 bg-red-500/10 text-red-200"
                        }`}
                      >
                        {item.reported ? "דיווח" : NO_REPORT_FLAG}
                      </span>
                    </div>

                    {otherFlags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {otherFlags.map((flag) => (
                          <span key={flag} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${flagClass(flag)}`}>
                            {flag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] text-[#9aa181]">
                      <div>
                        <p>🍽️ קלוריות</p>
                        <p className="mt-1 text-sm font-semibold text-white">{formatGoal(item.calories, item.calorie_goal)}</p>
                      </div>
                      <div>
                        <p>💧 מים</p>
                        <p className="mt-1 text-sm font-semibold text-white">{(item.water_ml / 1000).toFixed(1)}L</p>
                      </div>
                      <div>
                        <p>👟 צעדים</p>
                        <p className="mt-1 text-sm font-semibold text-white">{formatGoal(item.steps, item.steps_goal)}</p>
                      </div>
                      <div>
                        <p>⚖️ משקל</p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {item.weight_kg === null ? "—" : `${item.weight_kg} ק״ג`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
