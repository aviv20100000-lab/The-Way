import { useCallback, useEffect, useState } from "react";
import { getCsrfToken } from "@/lib/csrf-client";

const CACHE_KEY = "way_client_home";

type HomeCache = {
  quotes: string[];
  waterTotal: number;
  waterGoal: number;
  todaySteps: number;
  todayCalories: number;
  calorieGoal: number | null;
};

function readCache(): HomeCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as HomeCache) : null;
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
  const [todayCalories, setTodayCalories] = useState(cached?.todayCalories ?? 0);
  const [calorieGoal, setCalorieGoal] = useState<number | null>(cached?.calorieGoal ?? null);
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
      setTodayCalories(data.calories?.total ?? 0);
      setCalorieGoal(data.calories?.goal ?? null);
      writeCache({
        quotes: data.quotes ?? [],
        waterTotal: data.water?.total ?? 0,
        waterGoal: data.water?.goal ?? 2000,
        todaySteps: data.steps ?? 0,
        todayCalories: data.calories?.total ?? 0,
        calorieGoal: data.calories?.goal ?? null,
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
    if ("Notification" in window) {
      const perm = Notification.permission as string;
      setNotifStatus(perm === "granted" ? "granted" : perm === "denied" ? "denied" : "unknown");
    }
  }, [loadHome]);

  const addWater = useCallback(async (ml: number) => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const csrfToken = await getCsrfToken();
      if (csrfToken) headers["x-csrf-token"] = csrfToken;
      await fetch("/api/health/water", {
        method: "POST",
        body: JSON.stringify({ amount_ml: ml }),
        headers,
      });
      setWaterTotal((p) => p + ml);
    } catch (e) {
      console.error("Error adding water:", e);
    }
  }, []);

  const enableNotifications = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    try {
      const permission = await Notification.requestPermission();
      setNotifStatus(permission as "granted" | "denied");
      if (permission !== "granted") return;

      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) return;

      function urlBase64ToUint8Array(base64String: string) {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const csrfToken = await getCsrfToken();
      if (csrfToken) headers["x-csrf-token"] = csrfToken;
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers,
        body: JSON.stringify(sub),
      });
    } catch (e) {
      console.error("Error enabling notifications:", e);
    }
  }, []);

  return {
    quote,
    waterTotal,
    waterGoal,
    todaySteps,
    todayCalories,
    calorieGoal,
    isLoaded,
    notifStatus,
    isPwa,
    loadHome,
    addWater,
    enableNotifications,
  };
}
