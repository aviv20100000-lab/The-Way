import { useCallback, useEffect, useState } from "react";
import { getCsrfToken } from "@/lib/csrf-client";
import { subscribeCurrentDeviceToPush } from "@/lib/push-client";
import { getTodayDayKey } from "@/lib/jerusalem-day";

const CACHE_KEY = "way_client_home";

type HomeCache = {
  dayKey: string;
  quotes: string[];
  waterTotal: number;
  waterGoal: number;
  todaySteps: number;
  stepsGoal: number;
  todayCalories: number;
  calorieGoal: number | null;
  proteinGoal: number | null;
  weighInFrequencyWeeks: number | null;
  weighInWeekday: number | null;
  goalStatus: GoalStatus;
  daysSinceSignup: number;
  totalSteps: number;
};

type GoalStatus = {
  targetWeight: boolean;
  calories: boolean;
  protein: boolean;
  water: boolean;
  steps: boolean;
};

const DEFAULT_GOAL_STATUS: GoalStatus = {
  targetWeight: false,
  calories: false,
  protein: false,
  water: false,
  steps: false,
};

function readCache(): HomeCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeCache;
    // A PWA can stay open across the Jerusalem midnight boundary without
    // remounting. A cache written yesterday is worse than no cache — it would
    // render as today's total (todayCalories included) until the fetch below
    // resolves, so a trainee scanning a meal first thing sees yesterday's number
    // plus the new meal.
    if (parsed.dayKey !== getTodayDayKey()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: HomeCache) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

export function useClientHome() {
  const cached = readCache();
  const [quotes, setQuotes] = useState<string[]>(cached?.quotes ?? []);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const quote = quotes[quoteIdx] ?? "";
  const [waterTotal, setWaterTotal] = useState(cached?.waterTotal ?? 0);
  const [waterGoal, setWaterGoal] = useState(cached?.waterGoal ?? 2000);
  const [todaySteps, setTodaySteps] = useState(cached?.todaySteps ?? 0);
  const [stepsGoal, setStepsGoal] = useState(cached?.stepsGoal ?? 10000);
  const [todayCalories, setTodayCalories] = useState(cached?.todayCalories ?? 0);
  const [calorieGoal, setCalorieGoal] = useState<number | null>(cached?.calorieGoal ?? null);
  const [proteinGoal, setProteinGoal] = useState<number | null>(cached?.proteinGoal ?? null);
  const [weighInFrequencyWeeks, setWeighInFrequencyWeeks] = useState<number | null>(cached?.weighInFrequencyWeeks ?? null);
  const [weighInWeekday, setWeighInWeekday] = useState<number | null>(cached?.weighInWeekday ?? null);
  const [goalStatus, setGoalStatus] = useState<GoalStatus>(cached?.goalStatus ?? DEFAULT_GOAL_STATUS);
  const [daysSinceSignup, setDaysSinceSignup] = useState(cached?.daysSinceSignup ?? 0);
  const [totalSteps, setTotalSteps] = useState(cached?.totalSteps ?? 0);
  const [waterAddError, setWaterAddError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"unknown" | "granted" | "denied">("unknown");
  const [isPwa, setIsPwa] = useState(false);

  const loadHome = useCallback(async () => {
    try {
      const res = await fetch("/api/home");
      if (!res.ok) return;
      const data = await res.json();

      if (data.quotes?.length) {
        const shuffled = [...data.quotes].sort(() => Math.random() - 0.5);
        setQuotes(shuffled);
      }
      setWaterTotal(data.water?.total ?? 0);
      setWaterGoal(data.water?.goal ?? 2000);
      setTodaySteps(data.steps ?? 0);
      setStepsGoal(data.steps_goal ?? 10000);
      setTodayCalories(data.calories?.total ?? 0);
      setCalorieGoal(data.calories?.goal ?? null);
      setProteinGoal(data.protein_goal ?? null);
      setWeighInFrequencyWeeks(data.weigh_in_frequency_weeks ?? null);
      setWeighInWeekday(data.weigh_in_weekday ?? null);
      const nextGoalStatus: GoalStatus = {
        targetWeight: Boolean(data.goal_status?.target_weight),
        calories: Boolean(data.goal_status?.calories),
        protein: Boolean(data.goal_status?.protein),
        water: Boolean(data.goal_status?.water),
        steps: Boolean(data.goal_status?.steps),
      };
      setGoalStatus(nextGoalStatus);
      setDaysSinceSignup(data.days_since_signup ?? 0);
      setTotalSteps(data.total_steps ?? 0);
      writeCache({
        dayKey: getTodayDayKey(),
        quotes: data.quotes ?? [],
        waterTotal: data.water?.total ?? 0,
        waterGoal: data.water?.goal ?? 2000,
        todaySteps: data.steps ?? 0,
        stepsGoal: data.steps_goal ?? 10000,
        todayCalories: data.calories?.total ?? 0,
        calorieGoal: data.calories?.goal ?? null,
        proteinGoal: data.protein_goal ?? null,
        weighInFrequencyWeeks: data.weigh_in_frequency_weeks ?? null,
        weighInWeekday: data.weigh_in_weekday ?? null,
        goalStatus: nextGoalStatus,
        daysSinceSignup: data.days_since_signup ?? 0,
        totalSteps: data.total_steps ?? 0,
      });
    } catch (e) {
      console.error("Error loading home data:", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (quotes.length < 2) return;
    const id = setInterval(() => {
      setQuoteIdx(i => (i + 1) % quotes.length);
    }, 10000);
    return () => clearInterval(id);
  }, [quotes.length]);

  useEffect(() => {
    loadHome();
    setIsPwa(window.matchMedia("(display-mode: standalone)").matches);
    // Otherwise a PWA reopened after being backgrounded across midnight keeps
    // showing whatever was on screen when it was last active — mount only runs
    // once, so without this the trainee needs a hard reload to see today's data.
    const onVisible = () => {
      if (document.visibilityState === "visible") loadHome();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const cleanup = () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };

    if (!("Notification" in window)) return cleanup;
    const perm = Notification.permission as string;
    if (perm === "denied") {
      setNotifStatus("denied");
      return cleanup;
    }
    if (perm !== "granted") return cleanup;

    // OS permission being "granted" only means the browser will show a
    // notification if one arrives — it says nothing about whether the server
    // still has a matching subscription row (it can be gone after a device
    // change, a cleared service worker, or a stale row that never landed).
    // Re-subscribe silently so "granted" in this UI actually means delivery
    // works, not just that the permission prompt was answered once.
    subscribeCurrentDeviceToPush({ requestPermission: false })
      .then(() => setNotifStatus("granted"))
      .catch((error) => console.error("Error syncing client notifications:", error));
    return cleanup;
  }, [loadHome]);

  const addWater = useCallback(async (ml: number) => {
    setWaterAddError(null);
    setWaterTotal((previous) => previous + ml);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const csrfToken = await getCsrfToken();
      if (csrfToken) headers["x-csrf-token"] = csrfToken;
      const response = await fetch("/api/health/water", {
        method: "POST",
        body: JSON.stringify({ amount_ml: ml }),
        headers,
      });
      if (!response.ok) throw new Error("water update failed");
      return true;
    } catch (e) {
      setWaterTotal((previous) => Math.max(0, previous - ml));
      setWaterAddError("לא הצלחנו לעדכן את השתייה. נסה שוב.");
      console.error("Error adding water:", e);
      return false;
    }
  }, []);

  const enableNotifications = useCallback(async () => {
    try {
      await subscribeCurrentDeviceToPush();
      setNotifStatus("granted");
    } catch (error) {
      const permission = typeof Notification !== "undefined" ? Notification.permission : "default";
      setNotifStatus(permission === "denied" ? "denied" : "unknown");
      console.error("Error enabling notifications:", error);
      throw error;
    }
  }, []);

  return {
    quote,
    waterTotal,
    waterGoal,
    todaySteps,
    stepsGoal,
    todayCalories,
    calorieGoal,
    proteinGoal,
    weighInFrequencyWeeks,
    weighInWeekday,
    goalStatus,
    daysSinceSignup,
    totalSteps,
    waterAddError,
    isLoaded,
    notifStatus,
    isPwa,
    loadHome,
    addWater,
    enableNotifications,
  };
}
