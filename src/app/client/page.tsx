"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  const foodPhotoRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [foodError, setFoodError] = useState("");

  // Weight
  const weightPhotoRef = useRef<HTMLInputElement>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightTarget, setWeightTarget] = useState<number | null>(null);
  const [newWeight, setNewWeight] = useState("");
  const [weightPhoto, setWeightPhoto] = useState<File | null>(null);
  const [savingWeight, setSavingWeight] = useState(false);

  // Steps
  const stepsPhotoRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.name) setUserName(d.name); })
      .catch(() => {});
    loadHome();
    if ("Notification" in window) {
      setNotifStatus(Notification.permission as "granted" | "denied" | "unknown");
    }
  }, [loadHome]);

  async function enableNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    const permission = await Notification.requestPermission();
    setNotifStatus(permission as "granted" | "denied");
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
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
  }, [tab, loadWeight, loadLeaderboard]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function analyzeFood(file: File) {
    setAnalyzing(true);
    setFoodError("");
    setAiResult(null);
    const fd = new FormData();
    fd.append("photo", file);
    try {
      const res = await fetch("/api/analyze-food", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");
      setAiResult(data);
    } catch (e: unknown) {
      setFoodError(e instanceof Error ? e.message : "שגיאה בניתוח התמונה");
    }
    setAnalyzing(false);
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
    const fd = new FormData();
    fd.append("screenshot", file);
    const res = await fetch("/api/steps", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      setTodaySteps(data.steps);
      setStepsSuccess(`זוהו ${data.steps.toLocaleString()} צעדים!`);
      loadLeaderboard();
    }
    setUploadingSteps(false);
  }

  const waterPct = Math.min(100, Math.round((waterTotal / waterGoal) * 100));
  const latestWeight = weightLogs[0]?.weight_kg ?? null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">THE WAY</h1>
            <p className="text-xs text-gray-400">שלום, {userName}</p>
          </div>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">יציאה</button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4">

        {/* ══ HOME TAB ══ */}
        {tab === "home" && (
          <div className="space-y-4">
            {/* Quote */}
            {quote && (
              <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-5 text-white shadow-lg">
                <p className="text-sm opacity-75 mb-1">💬 המשפט של היום</p>
                <p className="text-lg font-semibold leading-snug">"{quote}"</p>
              </div>
            )}

            {/* Steps today */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">👟 צעדים היום</span>
                <span className="text-2xl font-bold text-indigo-600">{todaySteps.toLocaleString()}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100">
                <div className="h-2 rounded-full bg-indigo-400 transition-all" style={{ width: `${Math.min(100, (todaySteps / 10000) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-gray-400">יעד: 10,000 צעדים</p>
            </div>

            {/* Water */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-600">💧 מים היום</span>
                <span className="font-bold text-blue-600">{(waterTotal / 1000).toFixed(1)}L / {waterGoal / 1000}L</span>
              </div>
              <div className="h-3 w-full rounded-full bg-blue-50">
                <div className="h-3 rounded-full bg-blue-400 transition-all" style={{ width: `${waterPct}%` }} />
              </div>
              <div className="mt-3 flex gap-2">
                {[150, 250, 500].map((ml) => (
                  <button key={ml} onClick={() => addWater(ml)}
                    className="flex-1 rounded-xl bg-blue-50 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
                    +{ml}מ"ל
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications */}
            {notifStatus !== "granted" && (
              <button onClick={enableNotifications}
                className="flex w-full items-center gap-3 rounded-2xl bg-indigo-50 p-4 text-right shadow-sm border border-indigo-100">
                <span className="text-2xl">🔔</span>
                <div>
                  <p className="font-semibold text-indigo-800">אפשר התראות</p>
                  <p className="text-xs text-indigo-500">קבל תזכורות מים, הודעות מהמאמן ועוד</p>
                </div>
              </button>
            )}

            {/* Weight summary */}
            {latestWeight && (
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">⚖️ משקל אחרון</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-gray-800">{latestWeight}</span>
                  <span className="text-gray-400 mb-1">ק"ג</span>
                  {weightTarget && (
                    <span className="mr-auto text-sm text-green-600 font-medium">יעד: {weightTarget} ק"ג</span>
                  )}
                </div>
                {weightTarget && (
                  <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-green-400" style={{ width: `${Math.max(0, Math.min(100, 100 - ((latestWeight - weightTarget) / latestWeight) * 100))}%` }} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ FOOD TAB ══ */}
        {tab === "food" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">ניתוח אוכל עם AI</h2>

            <button
              onClick={() => foodPhotoRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50 p-10 text-indigo-600 hover:bg-indigo-100"
            >
              <span className="text-5xl">📸</span>
              <span className="font-semibold">צלם את הארוחה שלך</span>
              <span className="text-sm opacity-70">ה-AI ינתח קלוריות אוטומטית</span>
            </button>
            <input ref={foodPhotoRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) analyzeFood(f); e.target.value = ""; }} />

            {analyzing && (
              <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
                <div className="text-4xl mb-2 animate-spin">🔍</div>
                <p className="text-gray-600">ה-AI מנתח את הארוחה שלך...</p>
              </div>
            )}

            {foodError && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{foodError}</div>
            )}

            {aiResult && (
              <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
                {aiResult.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={aiResult.photo_url} alt="ארוחה" className="w-full rounded-xl object-cover max-h-48" />
                )}

                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-500">{aiResult.total_calories}</div>
                  <div className="text-sm text-gray-400">קלוריות סה"כ</div>
                </div>

                <div className="space-y-2">
                  {aiResult.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-400">~{item.estimated_weight_g} גרם</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-orange-500">{item.calories} קל'</p>
                        <p className="text-xs text-gray-400">
                          C:{item.carbs_g}g · P:{item.protein_g}g · F:{item.fat_g}g
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {aiResult.notes && (
                  <p className="text-sm text-gray-500 text-center italic">"{aiResult.notes}"</p>
                )}

                <button onClick={() => { setAiResult(null); foodPhotoRef.current?.click(); }}
                  className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700">
                  צלם ארוחה נוספת
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ WEIGHT TAB ══ */}
        {tab === "weight" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">מעקב משקל</h2>

            {/* Add weight */}
            <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
              <p className="font-medium text-gray-700">הזן משקל היום</p>
              <div className="flex gap-3">
                <input
                  type="number"
                  step="0.1"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  placeholder='ק"ג'
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-center text-xl font-bold"
                />
                <button onClick={() => weightPhotoRef.current?.click()}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-2xl">
                  {weightPhoto ? "✅" : "📸"}
                </button>
              </div>
              <input ref={weightPhotoRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setWeightPhoto(f); }} />
              <button onClick={saveWeight} disabled={savingWeight || !newWeight}
                className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                {savingWeight ? "שומר..." : "שמור משקל"}
              </button>
            </div>

            {/* Target */}
            {weightTarget && (
              <div className="rounded-xl bg-green-50 px-4 py-3 text-center">
                <span className="text-sm text-green-700">🎯 יעד משקל: <strong>{weightTarget} ק"ג</strong></span>
                {latestWeight && (
                  <p className="text-xs text-green-500 mt-1">
                    נשאר עוד {Math.max(0, latestWeight - weightTarget).toFixed(1)} ק"ג
                  </p>
                )}
              </div>
            )}

            {/* History */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">היסטוריה</p>
              {weightLogs.length === 0 && <p className="text-center text-gray-400 py-4">עדיין לא נרשם משקל</p>}
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
                      <p className="text-xs text-gray-400">
                        {new Date(log.logged_at).toLocaleDateString("he-IL")}
                      </p>
                    </div>
                  </div>
                  {i > 0 && (
                    <span className={`text-sm font-medium ${log.weight_kg < weightLogs[i - 1].weight_kg ? "text-green-500" : "text-red-400"}`}>
                      {log.weight_kg < weightLogs[i - 1].weight_kg ? "▼" : "▲"}
                      {Math.abs(log.weight_kg - weightLogs[i - 1].weight_kg).toFixed(1)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ STEPS TAB ══ */}
        {tab === "steps" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">תחרות צעדים</h2>

            {/* Upload screenshot */}
            <div className="rounded-2xl bg-white p-5 shadow-sm text-center space-y-3">
              <p className="text-sm text-gray-500">צלם סקרינשוט מאפליקציית הבריאות</p>
              <button onClick={() => stepsPhotoRef.current?.click()}
                disabled={uploadingSteps}
                className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {uploadingSteps ? "מעבד..." : "📱 העלה סקרינשוט"}
              </button>
              <input ref={stepsPhotoRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadStepsScreenshot(f); e.target.value = ""; }} />
              {stepsSuccess && <p className="text-green-600 font-semibold">{stepsSuccess}</p>}
              <p className="text-xs text-gray-400">הצעדים שלך היום: <strong>{todaySteps.toLocaleString()}</strong></p>
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

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white pb-safe">
        <div className="mx-auto flex max-w-lg">
          {([
            { id: "home", icon: "🏠", label: "בית" },
            { id: "food", icon: "🍽️", label: "אוכל" },
            { id: "weight", icon: "⚖️", label: "משקל" },
            { id: "steps", icon: "👟", label: "תחרות" },
          ] as { id: Tab; icon: string; label: string }[]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center py-3 text-xs transition ${tab === t.id ? "text-indigo-600" : "text-gray-400"}`}>
              <span className="text-2xl">{t.icon}</span>
              <span className="mt-0.5">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
