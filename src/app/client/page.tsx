"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import MealHistory from "@/components/MealHistory";
import ProgressRing from "@/components/ProgressRing";
import { PhotoUpload } from "@/components/PhotoUpload";
import { FoodItemGramAdjuster } from "@/components/FoodItemGramAdjuster";
import { WeightJourney } from "@/components/WeightJourney";
import { QuickMealLogger } from "@/components/QuickMealLogger";
import {
  useAuth,
  useClientHome,
  useFoodTracking,
  useWeightTracking,
  useStepsTracking,
} from "@/hooks";

const WaterTrackerTab = dynamic(() => import("@/app/client/water/page"), {
  loading: () => <div className="text-center py-8">טוען...</div>,
});

type Tab = "home" | "food" | "weight" | "steps" | "water";

export default function ClientPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("home");
  const [todayCaloriesConsumed, setTodayCaloriesConsumed] = useState(0);
  const [calorieGoalFromGoals, setCalorieGoalFromGoals] = useState<number | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileCurPw, setProfileCurPw] = useState("");
  const [profileNewPw, setProfileNewPw] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [goalInput, setGoalInput] = useState("");

  // Hooks
  const { user, logout } = useAuth();
  const { quote, waterTotal, waterGoal, todaySteps, notifStatus, isPwa, addWater, enableNotifications } = useClientHome();
  const { analyzing, aiResult, foodError, mealSaved, myMeals, todayCalories, calorieGoal, estimatingIndex, loadingMeals, analyzeFood, logMeal, resetAiResult, updateItemName, updateItemCalories, updateItemGrams, estimateItemNutrition, deleteItem, addItem, loadMyMeals, deleteMeal } = useFoodTracking();
  const { weightLogs, weightTarget, newWeight, weightPhoto, savingWeight, setNewWeight, setWeightPhoto, loadWeight, saveWeight } = useWeightTracking();
  const { leaderboard, foodLeaderboard, uploadingSteps, stepsSuccess, lbView, compType, setLbView, setCompType, loadLeaderboard, uploadStepsScreenshot } = useStepsTracking();

  useEffect(() => {
    if (tab === "weight") loadWeight();
    if (tab === "steps") loadLeaderboard();
    if (tab === "food") loadMyMeals();
  }, [tab, loadWeight, loadLeaderboard, loadMyMeals]);

  useEffect(() => {
    fetch("/api/nutrition/today")
      .then((r) => r.json())
      .then((d) => { setTodayCaloriesConsumed(d.total_calories ?? 0); setCalorieGoalFromGoals(d.goal_calories ?? null); })
      .catch(() => {});
  }, []);

  // Sync home-tab calorie counter after AI meal saved
  useEffect(() => {
    if (mealSaved === "saved") {
      fetch("/api/nutrition/today")
        .then((r) => r.json())
        .then((d) => { setTodayCaloriesConsumed(d.total_calories ?? 0); setCalorieGoalFromGoals(d.goal_calories ?? null); })
        .catch(() => {});
    }
  }, [mealSaved]);

  if (!user) return null;

  const waterPct = Math.min(100, Math.round((waterTotal / waterGoal) * 100));
  const stepsPct = Math.min(100, Math.round((todaySteps / 10000) * 100));
  const latestWeight = weightLogs[0]?.weight_kg ?? null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "בוקר טוב" : hour < 17 ? "צהריים טובים" : hour < 21 ? "ערב טוב" : "לילה טוב";

  return (
    <div className="min-h-screen pb-32 text-black-matte bg-white dark:bg-neutral-950 dark:text-neutral-50" dir="rtl">
      {/* Header */}
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-20 bg-white dark:bg-neutral-950 border-b border-neutral-100 dark:border-neutral-800"
      >
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-black-matte dark:text-neutral-50">THE WAY</h1>
            <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400" dir="ltr">by Aviv &amp; Liav</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setProfileName(user.name); setProfileError(""); setProfileCurPw(""); setProfileNewPw(""); setShowProfile(true); }}
              className="min-h-11 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 transition"
            >
              👤 פרופיל
            </button>
            <motion.button
              onClick={logout}
              whileHover={{ opacity: 0.8 }}
              whileTap={{ scale: 0.98 }}
              className="min-h-11 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-4 py-2 text-xs font-semibold text-black-matte dark:text-neutral-50 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-200"
            >
              יציאה
            </motion.button>
          </div>
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

            {/* Calorie Progress */}
            {(calorieGoalFromGoals !== null || todayCaloriesConsumed > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.5, type: "spring" }}
                className="rounded-2xl bg-white shadow-card p-6 hover:shadow-lg transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-base font-semibold text-black-matte">🔥 קלוריות היום</p>
                  {calorieGoalFromGoals && (
                    <span className="text-xs text-neutral-500">יעד: {calorieGoalFromGoals} קל׳</span>
                  )}
                </div>
                <div className="flex items-end gap-1 mb-3">
                  <span className="text-3xl font-bold text-orange-500">{todayCaloriesConsumed}</span>
                  {calorieGoalFromGoals && (
                    <span className="mb-1 text-sm text-neutral-500">/ {calorieGoalFromGoals} קל׳</span>
                  )}
                </div>
                {calorieGoalFromGoals && (
                  <div
                    className="w-full rounded-full bg-neutral-100 h-2"
                    role="progressbar"
                    aria-valuenow={todayCaloriesConsumed}
                    aria-valuemin={0}
                    aria-valuemax={calorieGoalFromGoals}
                    aria-label={`${todayCaloriesConsumed} קלוריות מתוך ${calorieGoalFromGoals}`}
                  >
                    <div
                      className="h-2 rounded-full bg-orange-400 transition-all"
                      style={{ width: `${Math.min(100, Math.round((todayCaloriesConsumed / calorieGoalFromGoals) * 100))}%` }}
                    />
                  </div>
                )}
              </motion.div>
            )}

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
          <div className="space-y-4">
            <motion.h2
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg font-semibold text-black-matte"
            >
              מה אכלת? 🍽️
            </motion.h2>

            {/* Quick logger — primary action */}
            <QuickMealLogger onSaved={() => {
              fetch("/api/nutrition/today").then(r => r.json()).then(d => {
                setTodayCaloriesConsumed(d.total_calories ?? 0);
                setCalorieGoalFromGoals(d.goal_calories ?? null);
              }).catch(() => {});
              loadMyMeals();
            }} />

            {/* Calorie goal quick-set */}
            {!calorieGoalFromGoals && !showGoalEdit && (
              <button onClick={() => { setGoalInput(""); setShowGoalEdit(true); }}
                className="w-full rounded-xl border border-dashed border-primary-300 py-2 text-sm text-primary-600 font-medium">
                + הגדר יעד קלוריות יומי
              </button>
            )}
            {showGoalEdit && (
              <div className="rounded-xl bg-primary-50 border border-primary-200 p-4 flex items-center gap-3">
                <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)}
                  placeholder="2000" min="500" max="5000"
                  className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-center font-bold text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <span className="text-sm text-neutral-500">קל'/יום</span>
                <button onClick={async () => {
                  const cal = parseInt(goalInput);
                  if (!cal || cal < 500) return;
                  const { withCsrf } = await import("@/lib/csrf-client");
                  await fetch("/api/goals", { method: "POST", headers: await withCsrf({ "Content-Type": "application/json" }), body: JSON.stringify({ daily_calories: cal }) });
                  setCalorieGoalFromGoals(cal);
                  setShowGoalEdit(false);
                }} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white">שמור</button>
                <button onClick={() => setShowGoalEdit(false)} className="text-neutral-400 text-sm">ביטול</button>
              </div>
            )}
            {calorieGoalFromGoals && (
              <button onClick={() => { setGoalInput(String(calorieGoalFromGoals)); setShowGoalEdit(true); }}
                className="text-xs text-neutral-400 underline">
                יעד: {calorieGoalFromGoals} קל'/יום · שנה
              </button>
            )}

            {/* Meal history — right below logger so it's always visible */}
            <MealHistory meals={myMeals} loading={loadingMeals} onDelete={deleteMeal} />

            {/* AI photo analysis — secondary */}
            <div className="space-y-3">
              <button
                onClick={() => setShowAiPanel(v => !v)}
                className="w-full rounded-2xl bg-gradient-to-l from-violet-600 to-indigo-600 px-5 py-4 text-white shadow-md flex items-center gap-3"
              >
                <span className="text-2xl">📸</span>
                <div className="flex-1 text-start">
                  <p className="font-bold text-sm">ניתוח קלוריות עם AI</p>
                  <p className="text-xs text-indigo-200">הערכת AI לתמונה — יש לבדוק ולתקן לפני שמירה</p>
                </div>
                <span className="text-lg">{showAiPanel ? "✕" : "+"}</span>
              </button>

              {showAiPanel && (
              <div className="space-y-4">
                <PhotoUpload onFile={analyzeFood} isLoading={analyzing} error={foodError} />

                {aiResult && (() => {
                  const total = aiResult.items.reduce((s, it) => s + (it.calories || 0), 0);
                  return (
                    <div className="rounded-2xl bg-white dark:bg-neutral-800 p-5 shadow-xs space-y-4">
                      {aiResult.photo_url && <img src={aiResult.photo_url} alt="ארוחה" className="w-full rounded-xl object-cover max-h-48" />}
                      <div className="text-center">
                        <div className="text-4xl font-bold text-orange-500">{total}</div>
                        <div className="text-sm text-gray-400 dark:text-gray-500">קלוריות</div>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                        זיהה לא נכון? תקן את השם ולחץ 🤖 שה-AI יחשב קלוריות מחדש 👇
                      </p>
                      <div className="space-y-3">
                        {aiResult.items.map((item, i) => (
                          <div key={i} className="rounded-xl bg-gray-50 dark:bg-neutral-700 px-4 py-3 space-y-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => updateItemName(i, e.target.value)}
                                placeholder="שם המאכל"
                                className="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 font-medium text-gray-800 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                              />
                              <button
                                onClick={() => estimateItemNutrition(i)}
                                disabled={estimatingIndex === i || !item.name.trim()}
                                title="זהה קלוריות עם AI"
                                aria-label="זהה קלוריות עם AI"
                                className="h-9 w-9 shrink-0 rounded-lg bg-primary-100 dark:bg-primary-950 text-lg text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900 disabled:opacity-40 transition-colors"
                              >
                                {estimatingIndex === i ? "⏳" : "🤖"}
                              </button>
                              <button
                                onClick={() => deleteItem(i)}
                                title="מחק פריט"
                                aria-label="מחק פריט"
                                className="h-9 w-9 shrink-0 rounded-lg bg-red-50 dark:bg-red-950 text-lg text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                              >
                                🗑️
                              </button>
                            </div>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <FoodItemGramAdjuster
                                itemIndex={i}
                                currentGrams={item.estimated_weight_g}
                                estimatedGrams={item.estimated_weight_g}
                                onChangeGrams={(idx, newGrams) => updateItemGrams(idx, newGrams)}
                              />
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={item.calories}
                                  onChange={(e) => updateItemCalories(i, parseInt(e.target.value, 10) || 0)}
                                  min="0"
                                  className="h-9 w-20 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-center font-bold text-orange-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                />
                                <span className="text-sm font-semibold text-orange-500">קל'</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={addItem}
                        className="w-full rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 py-2.5 text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all"
                      >
                        ➕ הוסף פריט
                      </button>
                      {mealSaved === "saved" ? (
                        <div className="rounded-xl bg-green-50 dark:bg-green-950 py-3 text-center font-semibold text-primary-600 dark:text-primary-400">✅ נשמר!</div>
                      ) : (
                        <motion.button
                          onClick={() => logMeal(aiResult.items.map((it) => ({ name: it.name, calories: it.calories, estimated_weight_g: it.estimated_weight_g })), total)}
                          disabled={mealSaved === "saving" || aiResult.items.length === 0}
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full rounded-xl bg-green-600 dark:bg-green-700 py-3 font-semibold text-white hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-all"
                        >
                          {mealSaved === "saving" ? "שומר..." : "✅ שמור"}
                        </motion.button>
                      )}
                      {mealSaved === "error" && (
                        <p className="text-center text-sm text-red-600 dark:text-red-400">שמירה נכשלה, נסה שוב</p>
                      )}
                      <motion.button
                        onClick={resetAiResult}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full rounded-xl bg-indigo-100 dark:bg-indigo-950 py-3 font-semibold text-indigo-700 dark:text-indigo-300"
                      >
                        צלם עוד
                      </motion.button>
                    </div>
                  );
                })()}
              </div>
              )}
            </div>
          </div>
        )}

        {/* WEIGHT TAB */}
        {tab === "water" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <WaterTrackerTab />
          </motion.div>
        )}

        {tab === "weight" && (
          <div className="space-y-6">
            <motion.h2
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg font-semibold text-black-matte"
            >
              משקל 📊
            </motion.h2>

            {/* Weight Journey Visualization */}
            {weightTarget && weightLogs.length > 0 && (
              <WeightJourney
                currentWeight={weightLogs[0]?.weight_kg ?? null}
                targetWeight={weightTarget}
                weightLogs={weightLogs}
                startingWeight={weightLogs[weightLogs.length - 1]?.weight_kg ?? weightLogs[0]?.weight_kg ?? 0}
              />
            )}

            {/* Input Card */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 p-6 border border-blue-200 dark:border-blue-800"
            >
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-4">כמה אתה שוקל היום?</p>
              <div className="flex gap-3">
                <input
                  type="number"
                  step="0.1"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  placeholder="ק״ג"
                  className="flex-1 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 px-4 py-3 text-center text-xl font-bold focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                />
              </div>
              <motion.button
                onClick={saveWeight}
                disabled={savingWeight || !newWeight}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="w-full mt-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 font-semibold text-white hover:shadow-lg disabled:opacity-50 transition-all"
              >
                {savingWeight ? "שומר..." : "✅ עדכן"}
              </motion.button>
            </motion.div>
          </div>
        )}

        {/* STEPS / COMPETITION TAB */}
        {tab === "steps" && (
          <div className="space-y-6">
            <motion.h2
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg font-semibold text-black-matte"
            >
              תחרות 🏆 יא כאובים
            </motion.h2>

            {/* Competition type toggle */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="flex rounded-2xl bg-neutral-100 dark:bg-neutral-800 p-1 gap-1"
            >
              {([["steps", "👟", "צעדים"], ["food", "🍽️", "קלוריות"]] as const).map(([type, icon, label]) => (
                <motion.button
                  key={type}
                  onClick={() => setCompType(type)}
                  whileTap={{ scale: 0.97 }}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    compType === type
                      ? "bg-white dark:bg-neutral-900 text-black-matte dark:text-neutral-50 shadow-sm"
                      : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </motion.button>
              ))}
            </motion.div>

            {/* Steps upload — only when steps view */}
            {compType === "steps" && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4"
                >
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    📱 צלם סקרינשוט מ<strong>בדיקת בריאות</strong> כדי לעדכן את צעדיך
                  </p>
                </motion.div>
                <PhotoUpload onFile={uploadStepsScreenshot} isLoading={uploadingSteps} error={undefined} />
                {stepsSuccess && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-5 text-center text-white"
                  >
                    <p className="font-semibold text-lg">✅ {stepsSuccess}</p>
                  </motion.div>
                )}
              </>
            )}

            {/* Food note — only when food view */}
            {compType === "food" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 p-4"
              >
                <p className="text-sm text-orange-900 dark:text-orange-100">
                  🍽️ כל ארוחה שתרשום בלשונית <strong>אוכל</strong> תופיע כאן אוטומטית
                </p>
              </motion.div>
            )}

            {/* Leaderboard card */}
            {(() => {
              const data = compType === "steps" ? leaderboard : foodLeaderboard;
              const unit = compType === "steps" ? "צעדים" : "קל׳";
              const icon = compType === "steps" ? "👟" : "🍽️";
              if (data.length === 0) return null;
              const sorted = data.slice().sort((a, b) => lbView === "today" ? b.today - a.today : b.week - a.week);
              return (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl bg-white dark:bg-neutral-800 shadow-card overflow-hidden"
                >
                  {/* Period toggle */}
                  <div className="flex border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-700">
                    {([["today", "📅 היומי"], ["week", "📊 השבועי"]] as const).map(([v, label]) => (
                      <motion.button
                        key={v}
                        onClick={() => setLbView(v)}
                        whileTap={{ scale: 0.98 }}
                        className={`flex-1 py-4 text-sm font-semibold transition-all ${
                          lbView === v
                            ? "border-b-2 border-primary-600 text-primary-600 bg-white dark:bg-neutral-800"
                            : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                        }`}
                      >
                        {label}
                      </motion.button>
                    ))}
                  </div>
                  {/* Rows */}
                  <div className="p-5 space-y-3">
                    {sorted.map((entry, i) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`flex items-center gap-4 rounded-xl px-4 py-3 transition-all ${
                          i === 0 ? "bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900 dark:to-orange-900 border border-amber-300 dark:border-amber-700"
                          : i === 1 ? "bg-gradient-to-r from-gray-100 to-blue-50 dark:from-gray-700 dark:to-blue-900 border border-gray-300 dark:border-gray-600"
                          : i === 2 ? "bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900 dark:to-amber-900 border border-orange-200 dark:border-orange-700"
                          : "bg-neutral-50 dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600"
                        }`}
                      >
                        <span className="text-2xl font-bold w-8 text-center">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </span>
                        <div className="flex-1">
                          <p className="font-semibold text-neutral-900 dark:text-neutral-100">{entry.name}</p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {(lbView === "today" ? entry.today : entry.week).toLocaleString()} {unit}
                          </p>
                        </div>
                        <motion.div
                          animate={{ scale: i === 0 ? [1, 1.1, 1] : 1 }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="text-2xl"
                        >
                          {icon}
                        </motion.div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              );
            })()}
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
          <div className="flex items-center justify-around gap-1 rounded-3xl border border-neutral-200/50 dark:border-neutral-700/50 bg-white/98 dark:bg-neutral-900/98 p-2 shadow-lg backdrop-blur-xl">
            {[
              { id: "home" as Tab, icon: "🏠", label: "בית" },
              { id: "food" as Tab, icon: "🍽️", label: "אוכל" },
              { id: "water" as Tab, icon: "💧", label: "מים" },
              { id: "weight" as Tab, icon: "⚖️", label: "משקל" },
              { id: "steps" as Tab, icon: "👟", label: "תחרות" },
            ].map((t) => (
              <motion.button
                key={t.id}
                onClick={() => setTab(t.id)}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2.5 px-1 text-[11px] font-medium transition-all ${
                  tab === t.id ? "bg-primary-600 text-white shadow-md" : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                <span>{t.label}</span>
              </motion.button>
            ))}
            <motion.button
              onClick={() => router.push("/chat")}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2.5 px-1 text-[11px] font-medium transition-all text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <span className="text-xl">💬</span>
              <span>צ׳אט</span>
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Profile modal */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowProfile(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4" dir="rtl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-neutral-900">הגדרות פרופיל</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-500 block mb-1">שם</label>
                <input value={profileName} onChange={e => setProfileName(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-500 block mb-1">סיסמה נוכחית</label>
                <input type="password" value={profileCurPw} onChange={e => setProfileCurPw(e.target.value)}
                  placeholder="רק אם רוצה לשנות סיסמה"
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-500 block mb-1">סיסמה חדשה</label>
                <input type="password" value={profileNewPw} onChange={e => setProfileNewPw(e.target.value)}
                  placeholder="12+ תווים, אותיות, מספר וסימן"
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>

            {profileError && <p className="text-sm text-red-600 text-center">{profileError}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowProfile(false)}
                className="flex-1 rounded-xl border border-neutral-200 py-3 text-sm font-semibold text-neutral-600">ביטול</button>
              <button disabled={profileSaving} onClick={async () => {
                setProfileSaving(true);
                setProfileError("");
                try {
                  const { withCsrf } = await import("@/lib/csrf-client");
                  const res = await fetch("/api/auth/profile", {
                    method: "PUT",
                    headers: await withCsrf({ "Content-Type": "application/json" }),
                    body: JSON.stringify({ name: profileName, currentPassword: profileCurPw || undefined, newPassword: profileNewPw || undefined }),
                  });
                  const data = await res.json();
                  if (!res.ok) { setProfileError(data.error); }
                  else { setShowProfile(false); }
                } catch { setProfileError("שגיאת רשת"); }
                setProfileSaving(false);
              }} className="flex-1 rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {profileSaving ? "שומר..." : "שמור"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
