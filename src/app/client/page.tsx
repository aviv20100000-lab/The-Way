"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import MealHistory from "@/components/MealHistory";
import ProgressRing from "@/components/ProgressRing";
import { PhotoUpload } from "@/components/PhotoUpload";
import { FoodItemGramAdjuster } from "@/components/FoodItemGramAdjuster";
import { scaleFoodMacros } from "@/lib/nutrition-calculations";
import {
  useAuth,
  useClientHome,
  useFoodTracking,
  useWeightTracking,
  useStepsTracking,
} from "@/hooks";

type Tab = "home" | "food" | "weight" | "steps";

export default function ClientPage() {
  const [tab, setTab] = useState<Tab>("home");

  // Hooks
  const { user, logout } = useAuth();
  const { quote, waterTotal, waterGoal, todaySteps, notifStatus, isPwa, addWater, enableNotifications } = useClientHome();
  const { analyzing, aiResult, foodError, itemGrams, mealSaved, myMeals, todayCalories, calorieGoal, setItemGrams, analyzeFood, logMeal, resetAiResult } = useFoodTracking();
  const { weightLogs, weightTarget, newWeight, weightPhoto, savingWeight, setNewWeight, setWeightPhoto, loadWeight, saveWeight } = useWeightTracking();
  const { leaderboard, uploadingSteps, stepsSuccess, lbView, setLbView, loadLeaderboard, uploadStepsScreenshot } = useStepsTracking();

  useEffect(() => {
    if (tab === "weight") loadWeight();
    if (tab === "steps") loadLeaderboard();
  }, [tab, loadWeight, loadLeaderboard]);

  if (!user) return null;

  const waterPct = Math.min(100, Math.round((waterTotal / waterGoal) * 100));
  const stepsPct = Math.min(100, Math.round((todaySteps / 10000) * 100));
  const latestWeight = weightLogs[0]?.weight_kg ?? null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "בוקר טוב" : hour < 17 ? "צהריים טובים" : hour < 21 ? "ערב טוב" : "לילה טוב";

  return (
    <div className="min-h-screen pb-32 text-black-matte bg-white" dir="rtl">
      {/* Header */}
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-20 bg-white border-b border-neutral-100"
      >
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-black-matte">THE WAY</h1>
            <span className="text-xs font-normal text-neutral-500">by Aviv & Liav</span>
          </div>
          <motion.button
            onClick={logout}
            whileHover={{ opacity: 0.8 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-lg bg-neutral-100 px-4 py-2 text-xs font-semibold text-black-matte hover:bg-neutral-200 transition-all duration-200"
          >
            יציאה
          </motion.button>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-5 pt-2 relative">
        {/* HOME TAB */}
        {tab === "home" && (
          <div className="space-y-6">
            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-2xl bg-white shadow-card p-8 space-y-4"
            >
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="text-xs font-normal tracking-wide text-neutral-500 uppercase"
              >
                {new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="text-3xl leading-tight text-black-matte"
              >
                {greeting}, {user.name || "אלוף"} 👋
              </motion.h2>
              {quote && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.5 }}
                  className="pt-4 border-t border-neutral-200"
                >
                  <p className="text-sm leading-relaxed text-neutral-600 italic">&ldquo;{quote}&rdquo;</p>
                </motion.div>
              )}
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5, type: "spring", stiffness: 100, damping: 15 }}
                className="flex flex-col items-center rounded-2xl bg-white shadow-card p-6 hover:shadow-lg transition-all"
              >
                <ProgressRing pct={stepsPct} size={88} stroke={8} color="#4f46e5" track="#f3f4f6">
                  <span className="text-xl font-bold text-black-matte">{(todaySteps / 1000).toFixed(todaySteps >= 1000 ? 1 : 0)}K</span>
                  <span className="mt-0.5 text-xs font-normal text-neutral-500">צעדים</span>
                </ProgressRing>
                <p className="mt-4 text-base font-semibold text-black-matte">👟 צעדים</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5, type: "spring", stiffness: 100, damping: 15 }}
                className="flex flex-col justify-between rounded-2xl bg-white shadow-card p-6 hover:shadow-lg transition-all"
              >
                <p className="text-sm font-semibold text-black-matte">⚖️ משקל</p>
                {latestWeight ? (
                  <div className="flex items-end gap-1.5 mt-4">
                    <span className="text-3xl font-bold text-black-matte">{latestWeight}</span>
                    <span className="mb-1 text-sm text-neutral-500">ק"ג</span>
                  </div>
                ) : (
                  <p className="py-3 text-sm text-neutral-500">עוד לא נשקלת</p>
                )}
              </motion.div>
            </div>

            {/* Water */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5, type: "spring" }}
              className="rounded-2xl bg-white shadow-card p-6 hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-5">
                <ProgressRing pct={waterPct} size={80} stroke={8} color="#4f46e5" track="#f3f4f6">
                  <span className="text-lg font-bold text-black-matte">{(waterTotal / 1000).toFixed(1)}</span>
                  <span className="text-xs font-normal text-neutral-500">ליטר</span>
                </ProgressRing>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-base font-semibold text-black-matte">💧 שתייה</p>
                    <p className="text-xs text-neutral-500 mt-1">יעד {(waterGoal / 1000).toFixed(1)} ליטר</p>
                  </div>
                  <div className="flex gap-2">
                    {[150, 250, 500].map((ml) => (
                      <motion.button
                        key={ml}
                        onClick={() => addWater(ml)}
                        whileTap={{ scale: 0.98 }}
                        className="flex-1 rounded-lg bg-primary-600 py-2 text-xs font-semibold text-white hover:bg-primary-700"
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
                transition={{ delay: 0.6, type: "spring" }}
                className="flex items-center gap-3 rounded-2xl bg-neutral-100 p-6 shadow-card"
              >
                <span className="text-2xl animate-bounce">✅</span>
                <p className="font-semibold text-black-matte">התראות דלוקות!</p>
              </motion.div>
            ) : !isPwa ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="rounded-2xl bg-neutral-100 p-6 shadow-card space-y-3"
              >
                <p className="font-semibold text-black-matte">📲 רוצה הודעות?</p>
              </motion.div>
            ) : (
              <motion.button
                onClick={enableNotifications}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, type: "spring" }}
                className="flex w-full items-center gap-4 rounded-2xl bg-primary-600 p-6 text-white shadow-card"
              >
                <span className="text-4xl">🔔</span>
                <div>
                  <p className="font-semibold">הפעל התראות</p>
                  <p className="text-xs text-white/70">לקבל הודעות מהמאמן</p>
                </div>
              </motion.button>
            )}
          </div>
        )}

        {/* FOOD TAB */}
        {tab === "food" && (
          <div className="space-y-6">
            <motion.h2
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg font-semibold text-black-matte"
            >
              מה אכלת? 🍽️
            </motion.h2>

            <PhotoUpload onFile={analyzeFood} isLoading={analyzing} error={foodError} />

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

              return (
                <div className="rounded-2xl bg-white p-5 shadow-xs space-y-4">
                  {aiResult.photo_url && <img src={aiResult.photo_url} alt="ארוחה" className="w-full rounded-xl object-cover max-h-48" />}
                  <div className="text-center">
                    <div className="text-4xl font-bold text-orange-500">{total}</div>
                    <div className="text-sm text-gray-400">קלוריות</div>
                  </div>
                  <div className="space-y-3">
                    {aiResult.items.map((item, i) => (
                      <div key={i} className="rounded-xl bg-gray-50 px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-800">{item.name}</p>
                          <p className="font-bold text-orange-500">{scaled[i].calories} קל'</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setItemGrams((prev) => {
                                const base = aiResult.items.map((it, idx) => prev[idx] ?? it.estimated_weight_g);
                                base[i] = Math.max(5, base[i] - 10);
                                return base;
                              })
                            }
                            className="h-9 w-9 rounded-lg bg-white border border-gray-200 text-lg font-bold"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={grams[i]}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 5;
                              setItemGrams((prev) => {
                                const base = aiResult.items.map((it, idx) => prev[idx] ?? it.estimated_weight_g);
                                base[i] = Math.max(5, val);
                                return base;
                              });
                            }}
                            className="w-16 rounded-lg border border-gray-200 bg-white py-1 text-center font-semibold"
                          />
                          <span className="text-sm text-gray-400">גרם</span>
                          <button
                            onClick={() =>
                              setItemGrams((prev) => {
                                const base = aiResult.items.map((it, idx) => prev[idx] ?? it.estimated_weight_g);
                                base[i] = Math.max(5, base[i] + 10);
                                return base;
                              })
                            }
                            className="h-9 w-9 rounded-lg bg-white border border-gray-200 text-lg font-bold"
                          >
                            ＋
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {mealSaved === "saved" ? (
                    <div className="rounded-xl bg-green-50 py-3 text-center font-semibold text-primary-600">✅ נשמר!</div>
                  ) : (
                    <button
                      onClick={() =>
                        logMeal(
                          aiResult.items.map((it, i) => ({
                            name: it.name,
                            calories: scaled[i].calories,
                            estimated_weight_g: grams[i],
                          })),
                          total
                        )
                      }
                      disabled={mealSaved === "saving"}
                      className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {mealSaved === "saving" ? "שומר..." : "✅ שמור"}
                    </button>
                  )}
                  <button onClick={resetAiResult} className="w-full rounded-xl bg-indigo-100 py-3 font-semibold text-indigo-700">
                    צלם עוד
                  </button>
                </div>
              );
            })()}

            {myMeals.length > 0 && <MealHistory meals={myMeals} />}
          </div>
        )}

        {/* WEIGHT TAB */}
        {tab === "weight" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">משקל</h2>
            <div className="rounded-2xl bg-white p-6 shadow-card space-y-4">
              <p className="text-base font-semibold">כמה אתה שוקל היום?</p>
              <div className="flex gap-3">
                <input
                  type="number"
                  step="0.1"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  placeholder="ק״ג"
                  className="flex-1 rounded-lg border border-neutral-200 px-4 py-3 text-center text-xl font-bold focus:ring-2 focus:ring-primary-600"
                />
              </div>
              <button
                onClick={saveWeight}
                disabled={savingWeight || !newWeight}
                className="w-full rounded-2xl bg-success-600 py-3 font-semibold text-white hover:shadow-lg disabled:opacity-50"
              >
                {savingWeight ? "שומר..." : "עדכן"}
              </button>
            </div>
            {weightLogs.length > 0 && (
              <div className="space-y-2">
                {weightLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-xs">
                    <p className="font-bold">{log.weight_kg} ק"ג</p>
                    <p className="text-xs text-neutral-500">{new Date(log.logged_at).toLocaleDateString("he-IL")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEPS TAB */}
        {tab === "steps" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">צעדים</h2>
            <div className="rounded-2xl bg-white p-5 shadow-xs space-y-3">
              <p className="text-sm text-center text-gray-500">צלם סקרינשוט מהבריאות</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-xl bg-indigo-600 py-3 text-center font-semibold text-white cursor-pointer hover:bg-indigo-700">
                  📷 מצלמה
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ opacity: 0, width: 0, height: 0 }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadStepsScreenshot(f);
                    }}
                  />
                </label>
                <label className="rounded-xl bg-indigo-600 py-3 text-center font-semibold text-white cursor-pointer hover:bg-indigo-700">
                  🖼️ גלריה
                  <input
                    type="file"
                    style={{ opacity: 0, width: 0, height: 0 }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadStepsScreenshot(f);
                    }}
                  />
                </label>
              </div>
              {uploadingSteps && <p className="text-sm text-center text-gray-500">קוראקורא...</p>}
              {stepsSuccess && <p className="text-center font-semibold text-primary-600">{stepsSuccess}</p>}
            </div>

            {leaderboard.length > 0 && (
              <div className="rounded-2xl bg-white shadow-xs overflow-hidden">
                <div className="flex border-b">
                  <button
                    onClick={() => setLbView("today")}
                    className={`flex-1 py-3 text-sm font-medium ${lbView === "today" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-400"}`}
                  >
                    יומי
                  </button>
                  <button
                    onClick={() => setLbView("week")}
                    className={`flex-1 py-3 text-sm font-medium ${lbView === "week" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-400"}`}
                  >
                    שבועי
                  </button>
                </div>
                <div className="p-4 space-y-2">
                  {leaderboard
                    .slice()
                    .sort((a, b) => (lbView === "today" ? b.today - a.today : b.week - a.week))
                    .map((entry, i) => (
                      <div key={entry.id} className="flex items-center gap-3 rounded-xl px-4 py-3 bg-gray-50">
                        <span className="text-lg font-bold w-6 text-center">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                        </span>
                        <span className="flex-1 font-medium">{entry.name}</span>
                        <span className="font-bold text-indigo-600">
                          {(lbView === "today" ? entry.today : entry.week).toLocaleString()} 👟
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <motion.nav
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7, type: "spring" }}
        className="fixed inset-x-0 bottom-0 z-20 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      >
        <div className="mx-auto max-w-lg px-5">
          <div className="flex items-center justify-around gap-1 rounded-3xl border border-neutral-200/50 bg-white/98 p-2 shadow-lg backdrop-blur-xl">
            {[
              { id: "home" as Tab, icon: "🏠", label: "בית" },
              { id: "food" as Tab, icon: "🍽️", label: "אוכל" },
              { id: "weight" as Tab, icon: "⚖️", label: "משקל" },
              { id: "steps" as Tab, icon: "👟", label: "תחרות" },
            ].map((t) => (
              <motion.button
                key={t.id}
                onClick={() => setTab(t.id)}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2.5 px-1 text-[11px] font-medium transition-all ${
                  tab === t.id ? "bg-primary-600 text-white shadow-md" : "text-neutral-500 hover:text-neutral-700"
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
