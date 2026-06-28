"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

function AnimatedScore({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const end = value;
    const duration = 900;
    const startTime = performance.now();
    cancelAnimationFrame(rafRef.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const cur = Math.round(start + (end - start) * ease);
      setDisplay(cur);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else prev.current = end;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);
  const formatted = display >= 1000 ? `${(display / 1000).toFixed(1)}K` : display.toLocaleString();
  return <span className={className}>{formatted}</span>;
}
import dynamic from "next/dynamic";
import MealHistory from "@/components/MealHistory";
import ProgressRing from "@/components/ProgressRing";
import AuroraBackground from "@/components/AuroraBackground";
import TiltCard from "@/components/TiltCard";
import BrandLogo from "@/components/BrandLogo";
import { PhotoUpload } from "@/components/PhotoUpload";
import MealScanner from "@/components/MealScanner";
import { WeightJourney } from "@/components/WeightJourney";
import { QuickMealLogger } from "@/components/QuickMealLogger";
import PageSkeleton from "@/components/PageSkeleton";
import {
  useAuth,
  useClientHome,
  useFoodTracking,
  useWeightTracking,
  useStepsTracking,
} from "@/hooks";

const WaterTrackerTab = dynamic(() => import("@/app/client/water/page"), {
  loading: () => (
    <div className="space-y-4 pt-2">
      <div className="skeleton h-80 rounded-3xl" />
      <div className="skeleton h-32 rounded-3xl" />
      <div className="skeleton h-24 rounded-3xl" />
    </div>
  ),
});

type Tab = "home" | "food" | "weight" | "steps" | "water";

export default function ClientPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("home");
  const [todayCaloriesConsumed, setTodayCaloriesConsumed] = useState(0);
  const [calorieGoalFromGoals, setCalorieGoalFromGoals] = useState<number | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(true);
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
  const { leaderboard, foodLeaderboard, uploadingSteps, stepsSuccess, lbView, compType, lbLoaded, setLbView, setCompType, loadLeaderboard, uploadStepsScreenshot } = useStepsTracking();

  useEffect(() => {
    loadWeight();
  }, [loadWeight]);

  // Prefetch the chat route bundle so tapping צ׳אט navigates instantly
  useEffect(() => {
    router.prefetch("/chat");
  }, [router]);

  // Warm the competition leaderboard in the background so the תחרות tab is
  // already populated by the time the user opens it (no on-tap wait).
  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Warm the lazily-loaded water tab chunk so switching to מים is instant
  // (no "download bundle then fetch" wait on first tap).
  useEffect(() => {
    import("@/app/client/water/page");
  }, []);

  useEffect(() => {
    if (tab === "steps") loadLeaderboard();
    if (tab === "food") loadMyMeals();
  }, [tab, loadLeaderboard, loadMyMeals]);

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

  if (!user) return <PageSkeleton variant="dashboard" />;

  const waterPct = Math.min(100, Math.round((waterTotal / waterGoal) * 100));
  const stepsPct = Math.min(100, Math.round((todaySteps / 10000) * 100));
  const latestWeight = weightLogs[0]?.weight_kg ?? null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "בוקר טוב" : hour < 17 ? "צהריים טובים" : hour < 21 ? "ערב טוב" : "לילה טוב";

  return (
    <div className="min-h-screen pb-32 bg-[#0c0f0f] text-[#e2e2e2]" dir="rtl" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      <AuroraBackground />

      {/* Header */}
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-20"
        style={{ background: "linear-gradient(180deg, #0c0f0f 85%, transparent)" }}
      >
        <style>{`
          @keyframes borderPulse {
            0%, 100% { opacity: 0.4; }
            50%       { opacity: 1; }
          }
          .header-border {
            background: linear-gradient(90deg, transparent, #c3f400 30%, #ffd700 60%, #c3f400 80%, transparent);
            animation: borderPulse 5s ease-in-out infinite;
          }
        `}</style>

        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3">
          <BrandLogo />
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setProfileName(user.name); setProfileError(""); setProfileCurPw(""); setProfileNewPw(""); setShowProfile(true); }}
              className="min-h-11 rounded-lg bg-[#1e2020] border border-[#444933] px-3 py-2 text-xs font-semibold text-[#c4c9ac] hover:border-[#c3f400] transition-colors"
            >
              👤
            </button>
            <motion.button
              onClick={logout}
              whileHover={{ opacity: 0.8 }}
              whileTap={{ scale: 0.98 }}
              className="min-h-11 rounded-lg bg-[#1e2020] border border-[#444933] px-4 py-2 text-xs font-semibold text-[#e2e2e2] hover:border-[#c3f400] transition-colors"
            >
              יציאה
            </motion.button>
          </div>
        </div>
        {/* Animated gradient border */}
        <div className="header-border h-px w-full" />
      </motion.header>

      <main className="mx-auto max-w-lg px-5 pt-2 relative">
        <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
        {/* HOME TAB */}
        {tab === "home" && (
          <div className="space-y-5">
            {/* Greeting — holographic HUD header */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="pt-3 pb-1"
            >
              <style>{`
                @keyframes greetShimmer { 0%{background-position:0% center} 50%{background-position:100% center} 100%{background-position:0% center} }
                @keyframes greetDot { 0%,100%{opacity:.4;transform:scale(.85)} 50%{opacity:1;transform:scale(1)} }
                @keyframes greetSweep { 0%{transform:translateX(2px);opacity:0} 12%{opacity:1} 88%{opacity:1} 100%{transform:translateX(158px);opacity:0} }
                @keyframes greetLine { 0%,100%{opacity:.35} 50%{opacity:.8} }
                .greet-name{
                  background:linear-gradient(120deg,#ffffff 0%,#c3f400 40%,#eaff7a 55%,#c3f400 68%,#ffffff 100%);
                  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
                  background-size:250% auto;animation:greetShimmer 5.5s ease-in-out infinite;
                  filter:drop-shadow(0 0 14px rgba(195,244,0,0.35));
                }
                .greet-dot{animation:greetDot 2s ease-in-out infinite}
                .greet-underline{position:relative;height:2px;overflow:hidden;border-radius:2px;
                  background:linear-gradient(90deg,#c3f400,rgba(195,244,0,0.04));animation:greetLine 3s ease-in-out infinite}
                .greet-underline::after{content:"";position:absolute;top:50%;right:0;width:6px;height:6px;margin-top:-3px;border-radius:50%;
                  background:#eaff7a;box-shadow:0 0 6px 1px rgba(234,255,122,.85);
                  animation:greetSweep 2.6s ease-in-out infinite}
              `}</style>

              <div className="flex items-stretch gap-3 min-w-0">
                {/* accent bar */}
                <motion.div
                  initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                  transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: 3, borderRadius: 3, transformOrigin: "top",
                    background: "linear-gradient(180deg, #c3f400, rgba(195,244,0,0.05))",
                    boxShadow: "0 0 10px rgba(195,244,0,0.5)" }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="greet-dot w-1.5 h-1.5 rounded-full" style={{ background: "#c3f400", boxShadow: "0 0 8px #c3f400" }} />
                    <p className="text-[10px] font-bold tracking-[0.28em] uppercase" style={{ color: "rgba(195,244,0,0.55)" }}>
                      {new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                  </div>
                  <p className="text-xs font-light tracking-wide text-[#6e7564] mb-0.5">{greeting}</p>
                  <h2 className="greet-name text-3xl font-black leading-none truncate pb-1">{user.name || "אלוף"}</h2>
                  {/* HUD underline that draws in, with a sweeping light dot */}
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: "168px" }}
                    transition={{ delay: 0.4, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="greet-underline mt-1.5"
                  />
                </div>
              </div>
            </motion.div>

            {/* Meal scan — main hero */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <MealScanner
                analyzing={analyzing}
                aiResult={aiResult}
                foodError={foodError}
                mealSaved={mealSaved}
                estimatingIndex={estimatingIndex}
                analyzeFood={analyzeFood}
                logMeal={logMeal}
                resetAiResult={resetAiResult}
                updateItemName={updateItemName}
                updateItemCalories={updateItemCalories}
                updateItemGrams={updateItemGrams}
                estimateItemNutrition={estimateItemNutrition}
                deleteItem={deleteItem}
                addItem={addItem}
              />
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <TiltCard className="flex flex-col items-center glass-card rounded-2xl p-6 transition-all" delay={0.3} max={10}>
                <ProgressRing pct={stepsPct} size={88} stroke={8} color="#6366f1" track="#333535">
                  <span className="text-xl font-bold text-white">{todaySteps >= 1000 ? `${(todaySteps / 1000).toFixed(1)}K` : todaySteps}</span>
                  <span className="mt-0.5 text-xs font-normal text-[#c4c9ac]">צעדים</span>
                </ProgressRing>
                <p className="mt-4 text-sm font-semibold tracking-wide text-[#c4c9ac]">צעדים</p>
              </TiltCard>

              <TiltCard className="flex flex-col justify-between glass-card rounded-2xl p-6 transition-all" delay={0.4} max={10}>
                <p className="text-xs font-semibold text-[#8e9379] tracking-widest uppercase">משקל</p>
                {latestWeight ? (
                  <div className="mt-2 space-y-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-white leading-none">{latestWeight}</span>
                      <span className="text-sm text-[#c4c9ac]">ק&quot;ג</span>
                    </div>
                    {weightTarget && (() => {
                      const startW = weightLogs[weightLogs.length - 1]?.weight_kg ?? latestWeight;
                      const totalDiff = Math.abs(startW - weightTarget);
                      const done = Math.abs(startW - latestWeight);
                      const pct = totalDiff > 0 ? Math.min(100, Math.round((done / totalDiff) * 100)) : 100;
                      const remaining = Math.abs(latestWeight - weightTarget);
                      return (
                        <div className="space-y-2">
                          <div className="h-1 rounded-full bg-[#333535] overflow-hidden">
                            <div className="h-full rounded-full bg-[#c3f400] transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-[#8e9379]">
                            {remaining > 0
                              ? `עוד ${remaining.toFixed(1)} ק"ג ליעד`
                              : `הגעת ליעד! 🎯`}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="py-3 text-sm text-[#c4c9ac]">עוד לא נשקלת</p>
                )}
              </TiltCard>
            </div>

            {/* Water */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5, type: "spring" }}
              className="glass-card rounded-2xl p-6 transition-all"
            >
              <div className="flex items-center gap-5">
                <ProgressRing pct={waterPct} size={80} stroke={8} color="#38bdf8" track="#333535">
                  <span className="text-lg font-bold text-white">{(waterTotal / 1000).toFixed(1)}</span>
                  <span className="text-xs font-normal text-[#c4c9ac]">ליטר</span>
                </ProgressRing>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-sm font-semibold tracking-wide text-white">שתייה</p>
                    <p className="text-xs text-[#c4c9ac] mt-1">יעד {(waterGoal / 1000).toFixed(1)} ליטר</p>
                  </div>
                  <div className="flex gap-2">
                    {[150, 250, 500].map((ml) => (
                      <motion.button
                        key={ml}
                        onClick={() => addWater(ml)}
                        whileHover={{ scale: 1.04, boxShadow: "0 0 16px rgba(56,189,248,0.35)" }}
                        whileTap={{ scale: 0.97 }}
                        className="flex-1 rounded-full border border-[#38bdf8]/30 bg-[#38bdf8]/10 text-[#38bdf8] py-2 text-xs font-bold transition-colors hover:bg-[#38bdf8]/20"
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
                className="glass-card rounded-2xl p-6 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold tracking-wide text-white">קלוריות היום</p>
                  {calorieGoalFromGoals && (
                    <span className="text-xs text-[#c4c9ac]">יעד: {calorieGoalFromGoals} קל׳</span>
                  )}
                </div>
                <div className="flex items-end gap-1 mb-3">
                  <span className="text-3xl font-bold text-[#c3f400]">{todayCaloriesConsumed}</span>
                  {calorieGoalFromGoals && (
                    <span className="mb-1 text-sm text-[#c4c9ac]">/ {calorieGoalFromGoals} קל׳</span>
                  )}
                </div>
                {calorieGoalFromGoals && (
                  <div
                    className="w-full rounded-full bg-[#333535] h-2"
                    role="progressbar"
                    aria-valuenow={todayCaloriesConsumed}
                    aria-valuemin={0}
                    aria-valuemax={calorieGoalFromGoals}
                    aria-label={`${todayCaloriesConsumed} קלוריות מתוך ${calorieGoalFromGoals}`}
                  >
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.round((todayCaloriesConsumed / calorieGoalFromGoals) * 100))}%`,
                        background: "linear-gradient(90deg, #f59e0b, #c3f400)",
                        boxShadow: "0 0 8px rgba(195,244,0,0.3)",
                      }}
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
                className="flex items-center gap-3 glass-card rounded-2xl p-6"
              >
                <span className="text-2xl animate-bounce">✅</span>
                <p className="font-semibold text-white">התראות דלוקות!</p>
              </motion.div>
            ) : !isPwa ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="glass-card rounded-2xl p-6 space-y-3"
              >
                <p className="font-semibold text-white">📲 רוצה הודעות?</p>
              </motion.div>
            ) : (
              <motion.button
                onClick={enableNotifications}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, type: "spring" }}
                className="flex w-full items-center gap-4 glass-card rounded-2xl p-6 text-white border border-[#c3f400]/20 lime-glow"
              >
                <span className="text-4xl">🔔</span>
                <div>
                  <p className="font-semibold">הפעל התראות</p>
                  <p className="text-xs text-[#c4c9ac]">לקבל הודעות מהמאמן</p>
                </div>
              </motion.button>
            )}
          </div>
        )}


        {/* FOOD TAB */}
        {tab === "food" && (
          <div className="space-y-4">
            <QuickMealLogger onSaved={() => {
              fetch("/api/nutrition/today").then(r => r.json()).then(d => {
                setTodayCaloriesConsumed(d.total_calories ?? 0);
                setCalorieGoalFromGoals(d.goal_calories ?? null);
              }).catch(() => {});
              loadMyMeals();
            }} />

            {!calorieGoalFromGoals && !showGoalEdit && (
              <button onClick={() => { setGoalInput(""); setShowGoalEdit(true); }}
                className="w-full rounded-xl border border-dashed border-[#444933] py-2 text-sm text-[#c3f400] font-medium hover:border-[#c3f400] transition-colors">
                + הגדר יעד קלוריות יומי
              </button>
            )}
            {showGoalEdit && (
              <div className="glass-card rounded-xl border border-[#444933] p-4 flex items-center gap-3">
                <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)}
                  placeholder="2000" min="500" max="5000"
                  className="flex-1 rounded-lg border border-[#444933] bg-[#282a2b] px-3 py-2 text-center font-bold text-[#c3f400] focus:outline-none focus:ring-2 focus:ring-[#c3f400]/30" />
                <span className="text-sm text-[#c4c9ac]">קל'/יום</span>
                <button onClick={async () => {
                  const cal = parseInt(goalInput);
                  if (!cal || cal < 500) return;
                  const { withCsrf } = await import("@/lib/csrf-client");
                  await fetch("/api/goals", { method: "POST", headers: await withCsrf({ "Content-Type": "application/json" }), body: JSON.stringify({ daily_calories: cal }) });
                  setCalorieGoalFromGoals(cal);
                  setShowGoalEdit(false);
                }} className="rounded-full bg-[#c3f400] px-4 py-2 text-sm font-bold text-[#161e00]">שמור</button>
                <button onClick={() => setShowGoalEdit(false)} className="text-[#8e9379] text-sm">ביטול</button>
              </div>
            )}
            {calorieGoalFromGoals && (
              <button onClick={() => { setGoalInput(String(calorieGoalFromGoals)); setShowGoalEdit(true); }}
                className="text-xs text-[#8e9379] underline">
                יעד: {calorieGoalFromGoals} קל'/יום · שנה
              </button>
            )}

            <MealHistory meals={myMeals} loading={loadingMeals} onDelete={deleteMeal} />
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

            {weightTarget && weightLogs.length > 0 && (
              <WeightJourney
                currentWeight={weightLogs[0]?.weight_kg ?? null}
                targetWeight={weightTarget}
                weightLogs={weightLogs}
                startingWeight={weightLogs[weightLogs.length - 1]?.weight_kg ?? weightLogs[0]?.weight_kg ?? 0}
              />
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-2xl p-6 border border-[#444933] overflow-hidden"
            >
              <p className="text-sm font-semibold text-[#c4c9ac] mb-4">כמה אתה שוקל היום?</p>
              <div className="flex items-center gap-2 w-full min-w-0">
                <input
                  type="number"
                  step="0.1"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  placeholder="0.0"
                  className="min-w-0 flex-1 rounded-xl border border-[#444933] bg-[#282a2b] text-white px-4 py-3 text-center text-xl font-bold focus:ring-2 focus:ring-[#c3f400]/30 focus:border-[#c3f400] transition-all"
                />
                <span className="text-sm font-semibold text-[#c4c9ac] shrink-0">ק״ג</span>
              </div>
              <motion.button
                onClick={saveWeight}
                disabled={savingWeight || !newWeight}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="w-full mt-4 rounded-full bg-[#c3f400] py-3 font-bold text-[#161e00] disabled:opacity-50 transition-all"
              >
                {savingWeight ? "שומר..." : "✅ עדכן"}
              </motion.button>
            </motion.div>
          </div>
        )}

        {/* STEPS / COMPETITION TAB */}
        {tab === "steps" && (() => {
          const sorted = leaderboard.slice().sort((a, b) => lbView === "today" ? b.today - a.today : b.week - a.week);
          const myEntry = sorted.find((e) => e.id === user.id);
          const myRank = myEntry ? sorted.indexOf(myEntry) + 1 : null;
          const maxVal = Math.max(...sorted.map((e) => lbView === "today" ? e.today : e.week), 1);
          const CROWN = ["#c3f400","#c8c8c8","#c8a951"];
          return (
          <div className="space-y-5">

            {/* Header row */}
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between">
              <div>
                <style>{`
                  @keyframes lbShimmer {
                    0%   { background-position: 0% center; }
                    50%  { background-position: 100% center; }
                    100% { background-position: 0% center; }
                  }
                  .lb-title {
                    background: linear-gradient(120deg, #ffffff 0%, #c3f400 35%, #ffd700 60%, #c3f400 80%, #ffffff 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    background-size: 250% auto;
                    animation: lbShimmer 4s ease-in-out infinite;
                  }
                  @keyframes imePulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(195,244,0,0.5); }
                    50%       { box-shadow: 0 0 0 4px rgba(195,244,0,0); }
                  }
                  .ime-badge { animation: imePulse 2s ease-in-out infinite; }
                  @keyframes firstGlow {
                    0%, 100% { opacity: 0.06; }
                    50%       { opacity: 0.13; }
                  }
                  .first-glow { animation: firstGlow 3s ease-in-out infinite; }
                `}</style>
                <h2 className="lb-title text-2xl font-black leading-none">לוח מנצחים</h2>
                {myRank && <p className="text-xs text-[#8e9379] mt-1">הדירוג שלך <span className="text-[#c3f400] font-bold">#{myRank}</span></p>}
              </div>
              {/* Time toggle — top right */}
              <div className="flex rounded-xl bg-[#1a1c1c] border border-[#2e3030] p-0.5 gap-0.5">
                {([["today","היום"],["week","שבוע"]] as const).map(([v,label]) => (
                  <button key={v} onClick={() => setLbView(v)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${lbView===v ? "bg-[#c3f400] text-[#161e00]" : "text-[#555] hover:text-[#888]"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Upload strip */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
              {stepsSuccess ? (
                <div className="flex items-center gap-3 rounded-2xl border border-[#c3f400]/20 bg-[#c3f400]/5 px-5 py-3.5">
                  <div className="w-5 h-5 rounded-full bg-[#c3f400] flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3 text-[#161e00]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <p className="text-sm font-semibold text-[#c3f400]">{stepsSuccess}</p>
                </div>
              ) : (
                <details className="group">
                  <summary className="flex items-center justify-between rounded-2xl border border-[#2e3030] bg-[#171919] px-5 py-3.5 cursor-pointer list-none select-none">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-[#555]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                      <span className="text-sm font-semibold text-white">עדכן צעדים</span>
                      <span className="text-xs text-[#555]">· סקרינשוט מ-בדיקת בריאות</span>
                    </div>
                    <svg className="w-3.5 h-3.5 text-[#444] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                  </summary>
                  <div className="pt-3"><PhotoUpload onFile={uploadStepsScreenshot} isLoading={uploadingSteps} error={undefined} /></div>
                </details>
              )}
            </motion.div>

            {/* Gap-to-leader banner */}
            {myEntry && myRank && myRank > 1 && sorted[0] && (() => {
              const leader = sorted[0];
              const leaderVal = lbView === "today" ? leader.today : leader.week;
              const myVal = lbView === "today" ? myEntry.today : myEntry.week;
              const gap = leaderVal - myVal;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex items-center gap-3 rounded-2xl border border-[#c3f400]/15 bg-[#c3f400]/5 px-5 py-3"
                >
                  <span className="text-lg">🎯</span>
                  <p className="text-sm text-[#c4c9ac]">
                    עוד <span className="font-black text-[#c3f400]">{gap.toLocaleString()}</span> צעדים כדי לעקוף את{" "}
                    <span className="font-bold text-white">{leader.name}</span>
                  </p>
                </motion.div>
              );
            })()}

            {/* Leaderboard */}
            {!lbLoaded && sorted.length === 0 ? (
              <div className="glass-card rounded-2xl border border-[#2e3030] overflow-hidden">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-[#1a1c1c] last:border-0">
                    <div className="skeleton h-4 w-4 rounded" />
                    <div className="skeleton h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 w-24 rounded" />
                      <div className="skeleton h-[3px] w-full rounded-full" />
                    </div>
                    <div className="skeleton h-4 w-10 rounded" />
                  </div>
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="glass-card rounded-2xl border border-[#2e3030] py-16 text-center">
                <p className="text-[#444] text-sm">אין נתונים עדיין</p>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                className="glass-card rounded-2xl border border-[#2e3030] overflow-hidden">
                {sorted.map((entry, i) => {
                  const val = lbView === "today" ? entry.today : entry.week;
                  const pct = Math.round((val / maxVal) * 100);
                  const isMe = entry.id === user.id;
                  const isFirst = i === 0;
                  const accent = i < 3 ? CROWN[i] : null;
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      className={`relative flex items-center gap-4 px-5 py-4 border-b border-[#1a1c1c] last:border-0 overflow-hidden ${isMe ? "bg-[#c3f400]/[0.04]" : ""}`}
                    >
                      {/* #1 animated glow bg */}
                      {isFirst && <div className="first-glow absolute inset-0 bg-[#c3f400] pointer-events-none" />}
                      {/* Left accent bar */}
                      {isFirst && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#c3f400]" style={{ boxShadow: "2px 0 12px rgba(195,244,0,0.6)" }} />}
                      {isMe && !isFirst && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#c3f400]/40" />}

                      {/* Rank */}
                      <div className="w-6 shrink-0 text-center">
                        {i < 3
                          ? <span className="text-base leading-none" style={{ filter: `drop-shadow(0 0 6px ${CROWN[i]}80)` }}>
                              {i===0?"🥇":i===1?"🥈":"🥉"}
                            </span>
                          : <span className={`text-xs font-black ${isMe ? "text-[#c3f400]" : "text-[#3a3c3c]"}`}>#{i+1}</span>
                        }
                      </div>

                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                        style={{
                          background: accent ? `${accent}18` : isMe ? "rgba(195,244,0,0.1)" : "#1e2020",
                          color: accent ?? (isMe ? "#c3f400" : "#8e9379"),
                          border: `1.5px solid ${accent ? `${accent}40` : isMe ? "rgba(195,244,0,0.25)" : "#2a2c2c"}`,
                        }}
                      >
                        {entry.name[0]}
                      </div>

                      {/* Name + bar */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold leading-none mb-2 truncate ${isMe || isFirst ? "text-white" : "text-[#c4c9ac]"}`}>
                          {entry.name}
                          {isMe && <span className="ime-badge mr-1.5 inline-block text-[9px] font-black text-[#161e00] bg-[#c3f400] rounded px-1 py-0.5 align-middle">אני</span>}
                        </p>
                        <div className="h-[3px] rounded-full bg-[#1e2020] overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: accent ?? (isMe ? "#c3f400" : "#333535") }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: i * 0.05 + 0.2, duration: 0.7, ease: [0.25,0.46,0.45,0.94] }}
                          />
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right shrink-0 min-w-[52px]">
                        <p className={`text-base font-black leading-none ${accent ? "" : isMe ? "text-[#c3f400]" : "text-white"}`}
                          style={accent ? { color: accent } : {}}>
                          <AnimatedScore value={val} />
                        </p>
                        <p className="text-[10px] text-[#444] mt-0.5">צעדים</p>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>
          );
        })()}
        </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <motion.nav
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7, type: "spring" }}
        className="fixed inset-x-0 bottom-0 z-20 pb-[env(safe-area-inset-bottom)]"
        style={{
          background: "rgba(18, 20, 20, 0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(195,244,0,0.12)",
        }}
      >
        <div className="mx-auto max-w-lg px-2">
          {(() => {
            const navItems = [
              { id: "home" as Tab, icon: "🏠", label: "בית" },
              { id: "food" as Tab, icon: "🍽️", label: "אוכל" },
              { id: "water" as Tab, icon: "💧", label: "מים" },
              { id: "weight" as Tab, icon: "⚖️", label: "משקל" },
              { id: "steps" as Tab, icon: "👟", label: "תחרות" },
              { id: "chat" as "chat", icon: "💬", label: "צ׳אט" },
            ];
            const allIds = navItems.map(n => n.id);
            const activeIdx = allIds.indexOf(tab as typeof allIds[number]);
            const pct = 100 / navItems.length;
            return (
              <div className="relative flex items-center p-2">
                {/* Sliding pill */}
                {activeIdx >= 0 && (
                  <div
                    className="nav-pill"
                    style={{
                      right: `calc(${activeIdx * pct}% + 4px)`,
                      width: `calc(${pct}% - 8px)`,
                    }}
                  />
                )}
                {navItems.map((t) => {
                  const isActive = tab === t.id;
                  return (
                    <motion.button
                      key={t.id}
                      onClick={() => t.id === "chat" ? router.push("/chat") : setTab(t.id as Tab)}
                      whileTap={{ scale: 0.88 }}
                      className={`relative flex flex-1 flex-col items-center pt-2 pb-1 text-[10px] font-semibold transition-colors duration-200 ${
                        isActive ? "text-[#c3f400]" : "text-[#555e55]"
                      }`}
                    >
                      <span className={`text-xl leading-none transition-transform duration-200 ${isActive ? "scale-110" : "scale-100"}`}>
                        {t.icon}
                      </span>
                      <span className="mt-1">{t.label}</span>
                      {isActive && <span className="nav-tab-active-dot" />}
                    </motion.button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </motion.nav>

      {/* Profile modal */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowProfile(false)}>
          <div className="glass-card w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4 border border-[#444933]" dir="rtl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white">הגדרות פרופיל</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#c4c9ac] block mb-1">שם</label>
                <input value={profileName} onChange={e => setProfileName(e.target.value)}
                  className="w-full rounded-xl border border-[#444933] bg-[#282a2b] text-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#c3f400]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#c4c9ac] block mb-1">סיסמה נוכחית</label>
                <input type="password" value={profileCurPw} onChange={e => setProfileCurPw(e.target.value)}
                  placeholder="רק אם רוצה לשנות סיסמה"
                  className="w-full rounded-xl border border-[#444933] bg-[#282a2b] text-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#c3f400]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#c4c9ac] block mb-1">סיסמה חדשה</label>
                <input type="password" value={profileNewPw} onChange={e => setProfileNewPw(e.target.value)}
                  placeholder="12+ תווים, אותיות, מספר וסימן"
                  className="w-full rounded-xl border border-[#444933] bg-[#282a2b] text-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#c3f400]" />
              </div>
            </div>

            {profileError && <p className="text-sm text-red-400 text-center">{profileError}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowProfile(false)}
                className="flex-1 rounded-xl border border-[#444933] py-3 text-sm font-semibold text-[#c4c9ac] hover:border-[#c3f400] transition-colors">ביטול</button>
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
              }} className="flex-1 rounded-xl bg-[#c3f400] text-[#161e00] py-3 text-sm font-bold disabled:opacity-50">
                {profileSaving ? "שומר..." : "שמור"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
