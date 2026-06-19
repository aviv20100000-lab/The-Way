"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import MealHistory from "@/components/MealHistory";
import ProgressRing from "@/components/ProgressRing";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

type Tab = "home" | "food" | "weight" | "steps";

interface AiItem {
  name: string;
  estimated_weight_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface AiResult {
  items: AiItem[];
  total_calories: number;
  notes: string;
  photo_url: string;
}

interface WeightLog {
  id: string;
  weight_kg: number;
  photo_url: string | null;
  logged_at: string;
}

interface MyMeal {
  id: string;
  total_calories: number;
  logged_at: string;
  items: { name: string; calories: number; estimated_weight_g: number }[];
}

interface LeaderboardEntry {
  id: string;
  name: string;
  today: number;
  week: number;
}

export default function ClientPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("home");
  const [userName, setUserName] = useState("");

  // Home
  const [quote, setQuote] = useState("");
  const [waterTotal, setWaterTotal] = useState(0);
  const [waterGoal, setWaterGoal] = useState(2000);
  const [todaySteps, setTodaySteps] = useState(0);
  const [notifStatus, setNotifStatus] = useState<"unknown" | "granted" | "denied">("unknown");

  // Food / AI
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [foodError, setFoodError] = useState("");
  const [itemGrams, setItemGrams] = useState<number[]>([]);
  const [mealSaved, setMealSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [myMeals, setMyMeals] = useState<MyMeal[]>([]);
  const [todayCalories, setTodayCalories] = useState(0);
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null);

  // Weight
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightTarget, setWeightTarget] = useState<number | null>(null);
  const [newWeight, setNewWeight] = useState("");
  const [weightPhoto, setWeightPhoto] = useState<File | null>(null);
  const [savingWeight, setSavingWeight] = useState(false);

  // Steps
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [uploadingSteps, setUploadingSteps] = useState(false);
  const [stepsSuccess, setStepsSuccess] = useState("");
  const [lbView, setLbView] = useState<"today" | "week">("today");

  const loadHome = useCallback(async () => {
    const [quoteRes, waterRes, stepsRes] = await Promise.all([
      fetch("/api/quotes"),
      fetch("/api/water"),
      fetch("/api/steps"),
    ]);
    const [q, w, s] = await Promise.all([quoteRes.json(), waterRes.json(), stepsRes.json()]);
    if (q.text) setQuote(q.text);
    setWaterTotal(w.total_ml ?? 0);
    setWaterGoal(w.goal_ml ?? 2000);
    setTodaySteps(s.steps ?? 0);
  }, []);

  const loadWeight = useCallback(async () => {
    const res = await fetch("/api/weight");
    const data = await res.json();
    setWeightLogs(data.logs ?? []);
    setWeightTarget(data.target ?? null);
  }, []);

  const loadLeaderboard = useCallback(async () => {
    const res = await fetch("/api/steps?type=leaderboard");
    const data = await res.json();
    setLeaderboard(data);
  }, []);

  const loadMyMeals = useCallback(async () => {
    const res = await fetch("/api/log-meal");
    if (!res.ok) return;
    const d = await res.json();
    setMyMeals(d.meals ?? []);
    setTodayCalories(d.today_calories ?? 0);
    setCalorieGoal(d.goal_calories ?? null);
  }, []);

  const [isPwa, setIsPwa] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.name) setUserName(d.name); })
      .catch(() => {});
    loadHome();
    setIsPwa(window.matchMedia("(display-mode: standalone)").matches);
    if ("Notification" in window) {
      const perm = Notification.permission as string;
      setNotifStatus(perm === "granted" ? "granted" : perm === "denied" ? "denied" : "unknown");
    }

    const match = document.cookie.split(";").find((c) => c.trim().startsWith("shared_food_result="));
    if (match) {
      try {
        const json = decodeURIComponent(match.trim().slice("shared_food_result=".length));
        setAiResult(JSON.parse(json));
        setTab("food");
      } catch { /* ignore */ }
      document.cookie = "shared_food_result=; max-age=0; path=/";
    }
  }, [loadHome]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enableNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    const permission = await Notification.requestPermission();
    setNotifStatus(permission as "granted" | "denied");
    if (permission !== "granted") return;

    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) return;

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
  }

  useEffect(() => {
    if (tab === "weight") loadWeight();
    if (tab === "steps") loadLeaderboard();
    if (tab === "food") loadMyMeals();
  }, [tab, loadWeight, loadLeaderboard, loadMyMeals]);

  useEffect(() => {
    setItemGrams(aiResult ? aiResult.items.map((it) => it.estimated_weight_g) : []);
    setMealSaved("idle");
  }, [aiResult]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function compressToJpeg(file: File): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height / width) * MAX); width = MAX; }
          else { width = Math.round((width / height) * MAX); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file),
          "image/jpeg", 0.82
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }

  async function analyzeFood(file: File) {
    setAnalyzing(true);
    setFoodError("");
    setAiResult(null);
    try {
      const jpeg = await compressToJpeg(file);
      const fd = new FormData();
      fd.append("photo", jpeg);
      const res = await fetch("/api/analyze-food", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");
      setAiResult(data);
    } catch (e: unknown) {
      setFoodError(e instanceof Error ? e.message : "שגיאה בניתוח התמונה");
    }
    setAnalyzing(false);
  }

  async function logMeal(items: { name: string; calories: number; estimated_weight_g: number }[], total: number) {
    setMealSaved("saving");
    try {
      const res = await fetch("/api/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, total_calories: total }),
      });
      if (res.ok) {
        setMealSaved("saved");
        loadMyMeals();
      } else {
        setMealSaved("error");
      }
    } catch {
      setMealSaved("error");
    }
  }

  async function addWater(ml: number) {
    await fetch("/api/water", { method: "POST", body: JSON.stringify({ amount_ml: ml }), headers: { "Content-Type": "application/json" } });
    setWaterTotal((p) => p + ml);
  }

  async function saveWeight() {
    const w = parseFloat(newWeight);
    if (!w || w < 20) return;
    setSavingWeight(true);
    const fd = new FormData();
    fd.append("weight", String(w));
    if (weightPhoto) fd.append("photo", weightPhoto);
    await fetch("/api/weight", { method: "POST", body: fd });
    setNewWeight("");
    setWeightPhoto(null);
    setSavingWeight(false);
    loadWeight();
  }

  async function uploadStepsScreenshot(file: File) {
    setUploadingSteps(true);
    setStepsSuccess("");
    try {
      const jpeg = await compressToJpeg(file);
      const fd = new FormData();
      fd.append("screenshot", jpeg);
      const res = await fetch("/api/steps", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setTodaySteps(data.steps);
        setStepsSuccess(`זוהו ${data.steps.toLocaleString()} צעדים!`);
        loadLeaderboard();
      }
    } catch { /* ignore */ }
    setUploadingSteps(false);
  }

  const waterPct = Math.min(100, Math.round((waterTotal / waterGoal) * 100));
  const stepsPct = Math.min(100, Math.round((todaySteps / 10000) * 100));
  const latestWeight = weightLogs[0]?.weight_kg ?? null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "בוקר טוב" : hour < 17 ? "צהריים טובים" : hour < 21 ? "ערב טוב" : "לילה טוב";
  const todayStr = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className={`min-h-screen pb-32 text-neutral-900 ${(tab === "home" || tab === "steps") ? "bg-event" : "bg-neutral-50"}`} dir="rtl">
      {/* Header */}
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-20 bg-neutral-50/80 backdrop-blur-xl border-b border-neutral-200/50"
      >
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-tight text-neutral-900">THE WAY</h1>
            <span className="text-xs font-medium text-neutral-500">by Aviv & Liav</span>
          </div>
          <motion.button
            onClick={logout}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-600 shadow-sm ring-1 ring-black/[0.04] transition"
          >
            יציאה
          </motion.button>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-4 pt-1 relative">
        {/* Background overlay for home and steps tabs */}
        {(tab === "home" || tab === "steps") && (
          <div className="fixed inset-0 bg-gradient-to-b from-neutral-50/75 via-neutral-50/65 to-neutral-50/75 pointer-events-none" style={{ top: "64px", zIndex: 0 }} />
        )}

        {/* ══ HOME TAB ══ */}
        {tab === "home" && (
          <div className="space-y-3.5">
            {/* Hero — greeting + quote */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-primary-900 to-primary-800 p-7 text-white shadow-floating"
            >
              <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-primary-400/[0.08] blur-3xl" />
              <div className="pointer-events-none absolute -right-20 -bottom-20 h-56 w-56 rounded-full bg-accent-400/[0.06] blur-3xl" />

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-xs font-medium tracking-wide text-white/50"
              >
                {todayStr}
              </motion.p>

              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
                className="mt-2 text-4xl font-black leading-tight tracking-tight"
              >
                {greeting}, {userName || "אלוף"} 👋
              </motion.h2>

              {quote && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.4 }}
                  className="mt-6 border-t border-white/10 pt-4"
                >
                  <p className="text-sm leading-relaxed text-white/70 italic">&ldquo;{quote}&rdquo;</p>
                </motion.div>
              )}
            </motion.div>

            {/* Stats row — steps + weight */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* Steps Card — Premium gradient */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
                className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 p-5 text-white shadow-lg hover:shadow-xl transition-shadow"
              >
                <ProgressRing pct={stepsPct} size={104} stroke={10} color="#ffffff" track="rgba(255,255,255,0.2)">
                  <span className="text-2xl font-bold text-white">{(todaySteps / 1000).toFixed(todaySteps >= 1000 ? 1 : 0)}K</span>
                  <span className="mt-0.5 text-[11px] font-medium text-white/70">צעדים</span>
                </ProgressRing>
                <p className="mt-4 text-sm font-bold text-white">👟 צעדים</p>
                <p className="text-xs text-white/70">מתוך 10,000</p>
              </motion.div>

              {/* Weight Card — Elegant gradient */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.5, type: "spring" }}
                className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 p-5 text-white shadow-lg hover:shadow-xl transition-shadow"
              >
                <p className="text-sm font-bold text-white">⚖️ משקל</p>
                {latestWeight ? (
                  <>
                    <div className="flex items-end gap-1.5 mt-2">
                      <motion.span
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.35, duration: 0.4 }}
                        className="text-4xl font-black leading-none text-white"
                      >
                        {latestWeight}
                      </motion.span>
                      <span className="mb-1 text-sm text-white/80">ק"ג</span>
                    </div>
                    {weightTarget && (
                      <div className="mt-3">
                        <div className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.max(0, Math.min(100, 100 - ((latestWeight - weightTarget) / latestWeight) * 100))}%`,
                            }}
                            transition={{ delay: 0.4, duration: 1 }}
                            className="h-2 rounded-full bg-white"
                          />
                        </div>
                        <p className="mt-1.5 text-xs font-medium text-white/80">יעד: {weightTarget} ק"ג</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="py-4 text-sm text-white/80">עוד לא נשקלת</p>
                )}
              </motion.div>
            </div>

            {/* Water */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5, type: "spring" }}
              className="rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 p-6 text-white shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center gap-4">
                <ProgressRing pct={waterPct} size={88} stroke={9} color="#ffffff" track="rgba(255,255,255,0.25)">
                  <span className="text-lg font-bold text-white">{(waterTotal / 1000).toFixed(1)}</span>
                  <span className="text-[10px] font-medium text-white/70">ליטר</span>
                </ProgressRing>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">💧 שתייה היום</p>
                  <p className="text-xs text-white/80">יעד {(waterGoal / 1000).toFixed(1)} ליטר</p>
                  <div className="mt-3 flex gap-2">
                    {[150, 250, 500].map((ml) => (
                      <motion.button
                        key={ml}
                        onClick={() => addWater(ml)}
                        whileTap={{ scale: 0.9 }}
                        whileHover={{ scale: 1.05 }}
                        className="flex-1 rounded-lg bg-white/20 py-2 text-sm font-semibold text-white hover:bg-white/30 active:scale-95 transition backdrop-blur-sm border border-white/20"
                      >
                        +{ml}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Notifications */}
            {notifStatus === "granted" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-5 text-white shadow-lg ring-1 ring-emerald-400/50"
              >
                <span className="text-2xl animate-bounce">✅</span>
                <p className="font-bold">התראות דלוקות — מעולה!</p>
              </motion.div>
            ) : !isPwa ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-white shadow-lg ring-1 ring-amber-300/50"
              >
                <p className="font-bold mb-3 text-lg">📲 רוצה לקבל הודעות מהמאמן?</p>
                <ol className="text-sm text-white/90 space-y-2 list-decimal list-inside">
                  <li>לחץ על כפתור השיתוף <strong>□↑</strong> בתחתית Safari</li>
                  <li>בחר <strong>"הוסף למסך הבית"</strong></li>
                  <li>פתח מהמסך הבית ולחץ על כפתור ההתראות</li>
                </ol>
              </motion.div>
            ) : (
              <motion.button
                onClick={enableNotifications}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.5 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex w-full items-center gap-4 rounded-2xl bg-gradient-to-r from-primary-700 to-primary-800 p-6 text-right text-white shadow-lg hover:shadow-xl transition-shadow"
              >
                <span className="text-3xl">🔔</span>
                <div>
                  <p className="font-bold text-lg">הפעל התראות</p>
                  <p className="text-xs text-white/70">כדי שהמאמן יוכל לשלוח לך הודעות</p>
                </div>
              </motion.button>
            )}
          </div>
        )}

        {/* ══ FOOD TAB ══ */}
        {tab === "food" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">מה אכלת? 🍽️</h2>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-5 text-indigo-600 hover:bg-indigo-100">
                <span className="text-3xl">📷</span>
                <span className="text-sm font-semibold">מצלמה</span>
                <input type="file" accept="image/*" capture="environment" style={{ opacity: 0, width: 0, height: 0, overflow: 'hidden' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) analyzeFood(f); e.target.value = ""; }} />
              </label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-5 text-indigo-600 hover:bg-indigo-100">
                <span className="text-3xl">🖼️</span>
                <span className="text-sm font-semibold">גלריה</span>
                <input type="file" style={{ opacity: 0, width: 0, height: 0, overflow: 'hidden' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) analyzeFood(f); e.target.value = ""; }} />
              </label>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-700 text-center">
              📲 ב-iOS — פתח תמונה ב-Photos, לחץ שתף ← <strong>THE WAY</strong>
            </div>

            {analyzing && (
              <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
                <div className="text-4xl mb-2 animate-spin">🔍</div>
                <p className="text-gray-600">מנתח את האוכל שלך, רגע אחד...</p>
              </div>
            )}

            {foodError && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{foodError}</div>
            )}

            {aiResult && (() => {
              const grams = aiResult.items.map((it, i) => itemGrams[i] ?? it.estimated_weight_g);
              const scaled = aiResult.items.map((it, i) => {
                const r = it.estimated_weight_g > 0 ? grams[i] / it.estimated_weight_g : 1;
                return {
                  calories: Math.round(it.calories * r),
                  carbs: Math.round(it.carbs_g * r),
                  protein: Math.round(it.protein_g * r),
                  fat: Math.round(it.fat_g * r),
                };
              });
              const total = scaled.reduce((s, x) => s + x.calories, 0);
              const setGram = (i: number, val: number) =>
                setItemGrams((prev) => {
                  const base = aiResult.items.map((it, idx) => prev[idx] ?? it.estimated_weight_g);
                  base[i] = Math.max(5, Math.round(val));
                  return base;
                });
              const step = (it: AiItem) => Math.max(5, Math.round(it.estimated_weight_g / 10));

              return (
              <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
                {aiResult.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={aiResult.photo_url} alt="ארוחה" className="w-full rounded-xl object-cover max-h-48" />
                )}

                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-500">{total}</div>
                  <div className="text-sm text-gray-400">קלוריות בארוחה</div>
                </div>

                <p className="text-xs text-gray-400 text-center">התאם את הכמות בגרמים והקלוריות יתעדכנו</p>

                <div className="space-y-3">
                  {aiResult.items.map((item, i) => (
                    <div key={i} className="rounded-xl bg-gray-50 px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <div className="text-right">
                          <p className="font-bold text-orange-500">{scaled[i].calories} קל'</p>
                          <p className="text-xs text-gray-400">
                            C:{scaled[i].carbs}g · P:{scaled[i].protein}g · F:{scaled[i].fat}g
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setGram(i, grams[i] - step(item))}
                          className="h-9 w-9 shrink-0 rounded-lg bg-white border border-gray-200 text-xl font-bold text-gray-600 active:bg-gray-100">−</button>
                        <div className="flex flex-1 items-center justify-center gap-1">
                          <input type="number" inputMode="numeric" value={grams[i]}
                            onChange={(e) => setGram(i, parseInt(e.target.value, 10) || 5)}
                            className="w-16 rounded-lg border border-gray-200 bg-white py-1 text-center font-semibold" />
                          <span className="text-sm text-gray-400">גרם</span>
                        </div>
                        <button onClick={() => setGram(i, grams[i] + step(item))}
                          className="h-9 w-9 shrink-0 rounded-lg bg-white border border-gray-200 text-xl font-bold text-gray-600 active:bg-gray-100">＋</button>
                      </div>
                    </div>
                  ))}
                </div>

                {aiResult.notes && (
                  <p className="text-sm text-gray-500 text-center italic">"{aiResult.notes}"</p>
                )}

                {mealSaved === "saved" ? (
                  <div className="rounded-xl bg-green-50 border border-green-100 py-3 text-center font-semibold text-green-700">
                    ✅ נשמר ונשלח למאמן!
                  </div>
                ) : (
                  <button
                    onClick={() => logMeal(
                      aiResult.items.map((it, i) => ({
                        name: it.name,
                        calories: scaled[i].calories,
                        estimated_weight_g: grams[i],
                      })),
                      total,
                    )}
                    disabled={mealSaved === "saving"}
                    className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                    {mealSaved === "saving" ? "שומר..." : "✅ שמור ושלח למאמן"}
                  </button>
                )}
                {mealSaved === "error" && (
                  <p className="text-center text-sm text-red-500">שגיאה בשמירה, נסה שוב</p>
                )}

                <button onClick={() => { setAiResult(null); setFoodError(""); }}
                  className="w-full rounded-xl bg-indigo-100 py-3 font-semibold text-indigo-700 hover:bg-indigo-200">
                  צלם עוד
                </button>
              </div>
              );
            })()}

            {/* Calories today */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">🔥 קלוריות היום</span>
                <span className="font-bold text-orange-500">
                  {todayCalories}{calorieGoal ? ` / ${calorieGoal}` : ""}
                </span>
              </div>
              {calorieGoal ? (
                <div className="h-2 w-full rounded-full bg-orange-50">
                  <div className="h-2 rounded-full bg-orange-400 transition-all"
                    style={{ width: `${Math.min(100, Math.round((todayCalories / calorieGoal) * 100))}%` }} />
                </div>
              ) : (
                <p className="text-xs text-gray-400">צלם ושמור ארוחות כדי לעקוב אחרי הקלוריות שלך</p>
              )}
            </div>

            {/* Food history — day / week / month */}
            {myMeals.length > 0 && <MealHistory meals={myMeals} />}
          </div>
        )}

        {/* ══ WEIGHT TAB ══ */}
        {tab === "weight" && (() => {
          const startWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight_kg : null;
          const currentWeight = weightLogs.length > 0 ? weightLogs[0].weight_kg : null;
          const totalToLose = startWeight && weightTarget ? startWeight - weightTarget : null;
          const alreadyLost = startWeight && currentWeight ? startWeight - currentWeight : 0;
          const progressPct = totalToLose && totalToLose > 0 ? Math.min(100, Math.max(0, (alreadyLost / totalToLose) * 100)) : 0;
          const isHalfway = progressPct >= 50;
          const isGoal = progressPct >= 100;

          // Next Sunday (every 2 weeks)
          const today = new Date();
          const dayOfWeek = today.getDay();
          const daysUntilSunday = dayOfWeek === 0 ? 14 : 7 - dayOfWeek;
          const nextWeighIn = new Date(today);
          nextWeighIn.setDate(today.getDate() + daysUntilSunday);
          const nextWeighInStr = nextWeighIn.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });

          const milestoneMsg = isGoal
            ? "הגעת! 🏆 הוכחת לעצמך שאפשר. עכשיו השמירה מתחילה."
            : isHalfway
            ? "חצי הדרך! עצרת רגע? זה בגלל שחצי הדרך מרגישה כמו שיא — אבל זה רק נקודת ההתחלה האמיתית. הגוף שלך כבר יודע שזה אפשרי. עכשיו תוכיח לו שאתה יודע גם."
            : progressPct >= 25
            ? "אתה בתנועה. כל שקילה שמוסיפה לתמונה — גם כשהמספר לא זז — היא הצלחה."
            : "כל קילוגרם שירד הוא הכי קשה — כי הוא היה צריך את האומץ להתחיל.";

          return (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800">מעקב משקל</h2>

              {/* Journey progress */}
              {startWeight && weightTarget && currentWeight && (
                <div className={`rounded-2xl p-5 shadow-sm space-y-4 ${isHalfway ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white" : "bg-white"}`}>
                  {isHalfway && (
                    <div className="text-center">
                      <div className="text-4xl mb-1">{isGoal ? "🏆" : "🎉"}</div>
                      <p className="font-bold text-lg">{isGoal ? "הגעת ליעד!" : "חצי הדרך!"}</p>
                    </div>
                  )}

                  <p className={`text-sm leading-relaxed ${isHalfway ? "text-indigo-100" : "text-gray-500"} text-center`}>
                    {milestoneMsg}
                  </p>

                  {/* Road track */}
                  <div className="relative pt-2 pb-2">
                    {/* Track background */}
                    <div className={`h-4 rounded-full ${isHalfway ? "bg-white/20" : "bg-gray-100"}`} />
                    {/* Progress fill */}
                    <div
                      className={`absolute top-2 right-0 h-4 rounded-full transition-all duration-700 ${isGoal ? "bg-yellow-400" : isHalfway ? "bg-white" : "bg-indigo-500"}`}
                      style={{ width: `${progressPct}%`, left: "auto" }}
                    />
                    {/* Halfway marker */}
                    <div className="absolute top-0 flex flex-col items-center" style={{ right: "50%", transform: "translateX(50%)" }}>
                      <div className={`w-1 h-6 ${isHalfway ? "bg-white/40" : "bg-gray-300"}`} />
                      <span className="text-xs mt-1 whitespace-nowrap" style={{ color: isHalfway ? "rgba(255,255,255,0.7)" : "#9ca3af" }}>חצי</span>
                    </div>
                    {/* Runner emoji at current position */}
                    <div
                      className="absolute -top-3 text-2xl transition-all duration-700"
                      style={{ right: `${progressPct}%`, transform: "translateX(50%)" }}
                    >
                      {isGoal ? "🏆" : "🏃"}
                    </div>
                  </div>

                  {/* Numbers */}
                  <div className="flex justify-between text-sm">
                    <div className="text-center">
                      <p className={`font-bold text-base ${isHalfway ? "text-white" : "text-gray-800"}`}>{startWeight}</p>
                      <p className={isHalfway ? "text-indigo-200 text-xs" : "text-gray-400 text-xs"}>התחלה</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold text-xl ${isHalfway ? "text-white" : "text-indigo-600"}`}>{currentWeight}</p>
                      <p className={isHalfway ? "text-indigo-200 text-xs" : "text-gray-400 text-xs"}>עכשיו</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold text-base ${isHalfway ? "text-yellow-300" : "text-green-600"}`}>{weightTarget}</p>
                      <p className={isHalfway ? "text-indigo-200 text-xs" : "text-gray-400 text-xs"}>יעד</p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className={`flex justify-around rounded-xl py-3 ${isHalfway ? "bg-white/15" : "bg-gray-50"}`}>
                    <div className="text-center">
                      <p className={`font-bold text-lg ${isHalfway ? "text-white" : "text-gray-800"}`}>{alreadyLost > 0 ? `-${alreadyLost.toFixed(1)}` : "0"}</p>
                      <p className={`text-xs ${isHalfway ? "text-indigo-200" : "text-gray-400"}`}>ק"ג ירדו</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold text-lg ${isHalfway ? "text-white" : "text-gray-800"}`}>{Math.round(progressPct)}%</p>
                      <p className={`text-xs ${isHalfway ? "text-indigo-200" : "text-gray-400"}`}>מהדרך</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold text-lg ${isHalfway ? "text-white" : "text-gray-800"}`}>{Math.max(0, (currentWeight ?? 0) - weightTarget).toFixed(1)}</p>
                      <p className={`text-xs ${isHalfway ? "text-indigo-200" : "text-gray-400"}`}>נשאר</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Next weigh-in */}
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">שקילה הבאה</p>
                  <p className="text-xs text-amber-600">{nextWeighInStr} • כל שבועיים ביום ראשון</p>
                </div>
              </div>

              {/* Add weight */}
              <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
                <p className="font-medium text-gray-700">כמה אתה שוקל היום?</p>
                <div className="flex gap-3">
                  <input type="number" step="0.1" value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    placeholder='ק"ג'
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-center text-xl font-bold" />
                  <label className="flex cursor-pointer items-center rounded-xl border border-gray-200 px-4 py-3 text-2xl hover:bg-gray-50" title="צילום">
                    📷
                    <input type="file" accept="image/*" capture="environment" style={{ opacity: 0, width: 0, height: 0, overflow: 'hidden' }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) setWeightPhoto(f); }} />
                  </label>
                  <label className="flex cursor-pointer items-center rounded-xl border border-gray-200 px-4 py-3 text-2xl hover:bg-gray-50" title="גלריה">
                    🖼️
                    <input type="file" style={{ opacity: 0, width: 0, height: 0, overflow: 'hidden' }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) setWeightPhoto(f); }} />
                  </label>
                  {weightPhoto && <span className="text-2xl flex items-center">✅</span>}
                </div>
                <button onClick={saveWeight} disabled={savingWeight || !newWeight}
                  className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                  {savingWeight ? "שומר..." : "עדכן משקל"}
                </button>
              </div>

              {/* History */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">היסטוריה</p>
                {weightLogs.length === 0 && <p className="text-center text-gray-400 py-4">עוד לא שקלת — בוא נתחיל 💪</p>}
                {weightLogs.map((log, i) => (
                  <div key={log.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      {log.photo_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={log.photo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        : <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">⚖️</div>
                      }
                      <div>
                        <p className="font-bold text-gray-800">{log.weight_kg} ק"ג</p>
                        <p className="text-xs text-gray-400">{new Date(log.logged_at).toLocaleDateString("he-IL")}</p>
                      </div>
                    </div>
                    {i < weightLogs.length - 1 && (
                      <span className={`text-sm font-medium ${log.weight_kg < weightLogs[i + 1].weight_kg ? "text-green-500" : "text-red-400"}`}>
                        {log.weight_kg < weightLogs[i + 1].weight_kg ? "▼" : "▲"}
                        {Math.abs(log.weight_kg - weightLogs[i + 1].weight_kg).toFixed(1)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ══ STEPS TAB ══ */}
        {tab === "steps" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">תחרות צעדים 👟</h2>

            {/* Upload screenshot */}
            <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
              <p className="text-sm text-gray-500 text-center">צלם סקרינשוט מאפליקציית הבריאות באייפון</p>
              <div className="grid grid-cols-2 gap-2">
                <label className={`rounded-xl bg-indigo-600 py-3 text-center font-semibold text-white hover:bg-indigo-700 cursor-pointer ${uploadingSteps ? "opacity-50 pointer-events-none" : ""}`}>
                  📷 מצלמה
                  <input type="file" accept="image/*" capture="environment" style={{ opacity: 0, width: 0, height: 0, overflow: 'hidden' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadStepsScreenshot(f); e.target.value = ""; }} />
                </label>
                <label className={`rounded-xl bg-indigo-600 py-3 text-center font-semibold text-white hover:bg-indigo-700 cursor-pointer ${uploadingSteps ? "opacity-50 pointer-events-none" : ""}`}>
                  🖼️ גלריה
                  <input type="file" style={{ opacity: 0, width: 0, height: 0, overflow: 'hidden' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadStepsScreenshot(f); e.target.value = ""; }} />
                </label>
              </div>
              {uploadingSteps && <p className="text-sm text-gray-500 text-center">קורא את הצעדים שלך...</p>}
              {stepsSuccess && <p className="text-green-600 font-semibold text-center">{stepsSuccess}</p>}
              <p className="text-xs text-gray-400 text-center">עשית היום: <strong>{todaySteps.toLocaleString()} צעדים</strong></p>
            </div>

            {/* Leaderboard */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="flex border-b">
                <button onClick={() => setLbView("today")}
                  className={`flex-1 py-3 text-sm font-medium ${lbView === "today" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-400"}`}>
                  יומי
                </button>
                <button onClick={() => setLbView("week")}
                  className={`flex-1 py-3 text-sm font-medium ${lbView === "week" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-400"}`}>
                  שבועי
                </button>
              </div>
              <div className="p-4 space-y-2">
                {leaderboard.length === 0 && <p className="text-center text-gray-400 py-4">אין נתונים עדיין</p>}
                {leaderboard
                  .slice()
                  .sort((a, b) => (lbView === "today" ? b.today - a.today : b.week - a.week))
                  .map((entry, i) => (
                    <div key={entry.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${entry.name === userName ? "bg-indigo-50" : "bg-gray-50"}`}>
                      <span className="text-lg font-bold w-6 text-center">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </span>
                      <span className="flex-1 font-medium text-gray-800">{entry.name}</span>
                      <span className="font-bold text-indigo-600">
                        {(lbView === "today" ? entry.today : entry.week).toLocaleString()} 👟
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav — floating pill */}
      <motion.nav
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4, type: "spring" }}
        className="fixed inset-x-0 bottom-0 z-20 pb-[calc(env(safe-area-inset-bottom)+12px)]"
      >
        <div className="mx-auto max-w-lg px-5">
          <div className="flex items-center justify-around gap-1 rounded-2xl border border-neutral-200/50 bg-white/95 p-1.5 shadow-floating backdrop-blur-xl">
            {([
              { id: "home", icon: "🏠", label: "בית" },
              { id: "food", icon: "🍽️", label: "אוכל" },
              { id: "weight", icon: "⚖️", label: "משקל" },
              { id: "steps", icon: "👟", label: "תחרות" },
            ] as { id: Tab; icon: string; label: string }[]).map((t) => (
              <motion.button
                key={t.id}
                onClick={() => setTab(t.id)}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2.5 px-1 text-[11px] font-medium transition-all duration-200 ${
                  tab === t.id
                    ? "bg-primary-600 text-white shadow-md"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                <span>{t.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.nav>
    </div>
  );
}
