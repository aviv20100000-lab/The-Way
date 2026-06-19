import { useCallback, useEffect, useState } from "react";

export function useClientHome() {
  const [quote, setQuote] = useState("");
  const [waterTotal, setWaterTotal] = useState(0);
  const [waterGoal, setWaterGoal] = useState(2000);
  const [todaySteps, setTodaySteps] = useState(0);
  const [notifStatus, setNotifStatus] = useState<"unknown" | "granted" | "denied">("unknown");
  const [isPwa, setIsPwa] = useState(false);

  const loadHome = useCallback(async () => {
    try {
      const [quoteRes, waterRes, stepsRes] = await Promise.all([
        fetch("/api/motivation/quotes"),
        fetch("/api/health/water"),
        fetch("/api/steps"),
      ]);
      const [q, w, s] = await Promise.all([
        quoteRes.json(),
        waterRes.json(),
        stepsRes.json(),
      ]);
      if (q.text) setQuote(q.text);
      setWaterTotal(w.total_ml ?? 0);
      setWaterGoal(w.goal_ml ?? 2000);
      setTodaySteps(s.steps ?? 0);
    } catch (e) {
      console.error("Error loading home data:", e);
    }
  }, []);

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
      await fetch("/api/health/water", {
        method: "POST",
        body: JSON.stringify({ amount_ml: ml }),
        headers: { "Content-Type": "application/json" },
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
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    notifStatus,
    isPwa,
    loadHome,
    addWater,
    enableNotifications,
  };
}
