"use client";

import { useEffect, useState, useRef, useMemo, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import ProgressRing from "@/components/ProgressRing";
import AuroraBackground from "@/components/AuroraBackground";
import TiltCard from "@/components/TiltCard";
import BrandLogo from "@/components/BrandLogo";
import PageSkeleton from "@/components/PageSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { useClientHome } from "@/hooks/client/useClientHome";
import { useFoodTracking } from "@/hooks/client/useFoodTracking";
import { useWeightTracking } from "@/hooks/client/useWeightTracking";
import { useStepsTracking } from "@/hooks/client/useStepsTracking";
import SuccessToast from "@/components/SuccessToast";
import { AnimatedScore } from "@/components/AnimatedScore";
import MilestoneCelebration, { type MilestoneCelebrationData } from "@/components/MilestoneCelebration";

const CELEBRATED_MILESTONES_KEY = "the-way:celebrated-milestones";
const WATER_GOAL_CELEBRATED_KEY = "the-way:water-goal-celebrated";

const WaterTrackerTab = dynamic(() => import("@/app/client/water/page"), {
  loading: () => (
    <div className="space-y-4 pt-2">
      <div className="skeleton h-80 rounded-3xl" />
      <div className="skeleton h-32 rounded-3xl" />
      <div className="skeleton h-24 rounded-3xl" />
    </div>
  ),
});

const MealHistory = dynamic(() => import("@/components/MealHistory"), {
  loading: () => <div className="skeleton h-48 rounded-3xl" />,
});

const PhotoUpload = dynamic(
  () => import("@/components/PhotoUpload").then((m) => ({ default: m.PhotoUpload })),
  { loading: () => <div className="skeleton h-32 rounded-3xl" /> }
);

const MealScanner = dynamic(() => import("@/components/MealScanner"), {
  loading: () => <div className="skeleton h-32 rounded-3xl" />,
});

const WeightJourney = dynamic(
  () => import("@/components/WeightJourney").then((m) => ({ default: m.WeightJourney })),
  { loading: () => <div className="skeleton h-64 rounded-3xl" /> }
);

const QuickMealLogger = dynamic(
  () => import("@/components/QuickMealLogger").then((m) => ({ default: m.QuickMealLogger })),
  { loading: () => <div className="skeleton h-24 rounded-3xl" /> }
);

const AvatarPhotoPicker = dynamic(() => import("@/components/AvatarPhotoPicker"), {
  loading: () => <div className="skeleton h-24 rounded-3xl" />,
});

const ConnectSetup = dynamic(() => import("@/components/ConnectSetup"), {
  loading: () => null,
});

type Tab = "home" | "food" | "weight" | "steps" | "water";

export default function ClientPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [tab, setTab] = useState<Tab>("home");
  const [clientNow, setClientNow] = useState<Date | null>(null);
  const [weightLoaded, setWeightLoaded] = useState(false);
  const [showHomeContent, setShowHomeContent] = useState(false);
  const [showFoodContent, setShowFoodContent] = useState(false);
  const [showWeightContent, setShowWeightContent] = useState(false);
  const [showStepsContent, setShowStepsContent] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileCurPw, setProfileCurPw] = useState("");
  const [profileNewPw, setProfileNewPw] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [goalInput, setGoalInput] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [waterGoalPulse, setWaterGoalPulse] = useState(false);
  const [milestoneQueue, setMilestoneQueue] = useState<MilestoneCelebrationData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const previousWaterTotalRef = useRef<number | null>(null);
  const celebratedMilestonesRef = useRef<Set<string> | null>(null);
  const homeRefreshReadyRef = useRef(false);

  // Hooks
  const { user, isLoading, logout } = useAuth();
  const { quote, waterTotal, waterGoal, todaySteps, stepsGoal, todayCalories: todayCaloriesConsumed, calorieGoal: calorieGoalFromGoals, proteinGoal, streak, isLoaded: homeLoaded, notifStatus, isPwa, addWater, enableNotifications, loadHome } = useClientHome();
  const { analyzing, aiResult, foodError, mealSaved, myMeals, todayCalories, calorieGoal, estimatingIndex, loadingMeals, mealsLoaded, lastSavedMealId, sharingMeal, shareMealError, mealShared, sharePromptDismissed, analyzeFood, logMeal, shareMealToGroup, dismissSharePrompt, resetAiResult, updateItemName, updateItemCalories, updateItemGrams, estimateItemNutrition, deleteItem, addItem, loadMyMeals, deleteMeal } = useFoodTracking();
  const { weightLogs, weightTarget, newWeight, weightPhoto, savingWeight, isLoaded: weightDataLoaded, setNewWeight, setWeightPhoto, loadWeight, saveWeight } = useWeightTracking();
  const { leaderboard, uploadingSteps, stepsSuccess, lbView, lbLoaded, setLbView, loadLeaderboard, uploadStepsScreenshot } = useStepsTracking();

  const handleSaveWeight = async () => {
    if (await saveWeight()) setSuccessMessage("המשקל נשמר");
  };

  useEffect(() => {
    if (!homeLoaded) return;

    const previousWaterTotal = previousWaterTotalRef.current;
    previousWaterTotalRef.current = waterTotal;

    if (previousWaterTotal === null || waterGoal <= 0) return;
    if (previousWaterTotal >= waterGoal || waterTotal < waterGoal) return;

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    try {
      if (localStorage.getItem(WATER_GOAL_CELEBRATED_KEY) === today) return;
      localStorage.setItem(WATER_GOAL_CELEBRATED_KEY, today);
    } catch {}

    setSuccessMessage(`הגעת ליעד המים היומי — ${(waterGoal / 1000).toFixed(1)} ליטר`);
    if (!prefersReducedMotion) setWaterGoalPulse(true);
  }, [homeLoaded, prefersReducedMotion, waterGoal, waterTotal]);

  const latestWeight = weightLogs[0]?.weight_kg ?? null;
  const oldestWeight = weightLogs[weightLogs.length - 1]?.weight_kg ?? latestWeight;
  const totalWeightLost = latestWeight !== null && oldestWeight !== null
    ? Math.max(0, oldestWeight - latestWeight)
    : 0;

  useEffect(() => {
    const reachedMilestones: MilestoneCelebrationData[] = [];

    if (homeLoaded && [3, 7, 14, 30, 50, 100].includes(streak)) {
      reachedMilestones.push({
        id: `streak-${streak}`,
        value: streak,
        suffix: "ימים",
        message: `${streak} ימים ברצף`,
      });
    }

    if (weightLogs.length >= 2) {
      [3, 5, 10, 15].forEach((kilograms) => {
        if (totalWeightLost >= kilograms) {
          reachedMilestones.push({
            id: `weight-${kilograms}`,
            value: kilograms,
            suffix: "ק״ג",
            message: `${kilograms} ק״ג פחות`,
          });
        }
      });
    }

    if (reachedMilestones.length === 0) return;

    if (!celebratedMilestonesRef.current) {
      let storedMilestones: string[] = [];
      try {
        const stored = localStorage.getItem(CELEBRATED_MILESTONES_KEY);
        const parsed: unknown = stored ? JSON.parse(stored) : [];
        if (Array.isArray(parsed)) {
          storedMilestones = parsed.filter((item): item is string => typeof item === "string");
        }
      } catch {}
      celebratedMilestonesRef.current = new Set(storedMilestones);
    }

    const celebratedMilestones = celebratedMilestonesRef.current;
    const newMilestones = reachedMilestones.filter((milestone) => !celebratedMilestones.has(milestone.id));
    if (newMilestones.length === 0) return;

    newMilestones.forEach((milestone) => celebratedMilestones.add(milestone.id));
    try {
      localStorage.setItem(CELEBRATED_MILESTONES_KEY, JSON.stringify([...celebratedMilestones]));
    } catch {}
    setMilestoneQueue((current) => [...current, ...newMilestones]);
  }, [homeLoaded, streak, totalWeightLost, weightLogs.length]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (refreshing || !["home", "food", "steps"].includes(tab)) return;
    touchStartY.current = event.touches[0].clientY;
    setPullDistance(0);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (refreshing || !["home", "food", "steps"].includes(tab) || touchStartY.current === 0) return;
    const distance = event.touches[0].clientY - touchStartY.current;
    if (distance > 0 && window.scrollY <= 0) setPullDistance(distance);
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 80 && ["home", "food", "steps"].includes(tab)) {
      try { navigator.vibrate?.(15); } catch {}
      setRefreshing(true);
      try {
        if (tab === "home") await loadHome();
        if (tab === "food") await loadMyMeals(true);
        if (tab === "steps") await loadLeaderboard(true);
      } finally {
        setRefreshing(false);
      }
    }
    touchStartY.current = 0;
    setPullDistance(0);
  };

  // Prefetch the chat route bundle so tapping צ׳אט navigates instantly

  // Warm the lazily-loaded water tab chunk so switching to מים is instant
  useEffect(() => {
    const connection = "connection" in navigator ? (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection : undefined;

    if (connection?.saveData || connection?.effectiveType === "2g") return;

    const warmChat = () => {
      router.prefetch("/chat");
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warmChat, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }

    const timeout = setTimeout(warmChat, 800);
    return () => clearTimeout(timeout);
  }, [router]);

  useEffect(() => {
    setClientNow(new Date());
  }, []);

  useEffect(() => {
    if (weightLoaded) return;
    setWeightLoaded(true);
    void loadWeight();
  }, [weightLoaded, loadWeight]);

  useEffect(() => {
    if (tab === "steps") loadLeaderboard();
    if (tab === "home" || tab === "food") loadMyMeals();
    // Refresh home stats when returning to the home tab (skip the initial
    // mount — useClientHome already fetches once on load).
    if (tab === "home") {
      if (homeRefreshReadyRef.current) loadHome();
      else homeRefreshReadyRef.current = true;
    }
  }, [tab, loadLeaderboard, loadMyMeals, loadHome]);

  // Sync home-tab calorie counter after AI meal saved
  useEffect(() => {
    if (mealSaved === "saved") loadHome();
  }, [mealSaved, loadHome]);

  useEffect(() => {
    if (tab !== "home") return;
    if (!homeLoaded) {
      setShowHomeContent(false);
      return;
    }
    setShowHomeContent(true);
  }, [tab, homeLoaded]);

  useEffect(() => {
    if (tab !== "food") return;
    if (!mealsLoaded && loadingMeals) {
      setShowFoodContent(false);
      return;
    }
    if (!mealsLoaded && myMeals.length === 0) {
      setShowFoodContent(false);
      return;
    }
    setShowFoodContent(true);
  }, [tab, mealsLoaded, loadingMeals, myMeals.length]);

  useEffect(() => {
    if (tab !== "weight") return;
    if (!weightDataLoaded) {
      setShowWeightContent(false);
      return;
    }
    setShowWeightContent(true);
  }, [tab, weightDataLoaded]);

  useEffect(() => {
    if (tab !== "steps") return;
    const hasData = leaderboard.length > 0;
    if (!lbLoaded && !hasData) {
      setShowStepsContent(false);
      return;
    }
    setShowStepsContent(true);
  }, [tab, lbLoaded, leaderboard.length]);
  const sortedLeaderboard = useMemo(
    () => leaderboard.slice().sort((a, b) => (lbView === "today" ? b.today - a.today : b.week - a.week)),
    [leaderboard, lbView]
  );
  const myLeaderboardEntry = useMemo(
    () => (user ? sortedLeaderboard.find((entry) => entry.id === user.id) ?? null : null),
    [sortedLeaderboard, user]
  );
  const myLeaderboardRank = myLeaderboardEntry ? sortedLeaderboard.indexOf(myLeaderboardEntry) + 1 : null;
  const leaderboardMaxValue = useMemo(
    () => Math.max(...sortedLeaderboard.map((entry) => (lbView === "today" ? entry.today : entry.week)), 1),
    [sortedLeaderboard, lbView]
  );

  if (isLoading || !user) return <PageSkeleton variant="dashboard" />;

  const waterPct = Math.min(100, Math.round((waterTotal / waterGoal) * 100));
  const stepsPct = Math.min(100, Math.round((todaySteps / stepsGoal) * 100));
  const hour = clientNow?.getHours() ?? 12;
  const greeting = hour < 12 ? "בוקר טוב" : hour < 17 ? "צהריים טובים" : hour < 21 ? "ערב טוב" : "לילה טוב";
  const greetingDate = clientNow?.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" }) ?? "";

  return (
    <div
      className="min-h-screen pb-32 bg-[#0c0f0f] text-[#e2e2e2]"
      dir="rtl"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AuroraBackground />

      {pullDistance > 0 && (
        <motion.div
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center"
          style={{ height: pullDistance }}
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
        >
          <motion.div
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c3f400]/25 bg-[#1a1c1c] text-2xl font-bold text-[#c3f400] shadow-lg"
            animate={{ rotate: prefersReducedMotion ? 0 : refreshing ? 360 : (pullDistance / 80) * 360 }}
            transition={{ duration: refreshing && !prefersReducedMotion ? 1 : 0, repeat: refreshing && !prefersReducedMotion ? Infinity : 0 }}
            aria-label={refreshing ? "מרענן" : "משוך לרענון"}
          >
            {refreshing ? "↻" : "↓"}
          </motion.div>
        </motion.div>
      )}

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
          !showHomeContent ? (
            <div className="space-y-5 pt-3">
              <div className="space-y-2">
                <div className="skeleton h-3 w-32 rounded" />
                <div className="skeleton h-8 w-44 rounded-lg" />
              </div>
              <div className="skeleton h-40 w-full rounded-2xl" />
              <div className="grid grid-cols-2 gap-4">
                <div className="skeleton h-44 rounded-2xl" />
                <div className="skeleton h-44 rounded-2xl" />
              </div>
              <div className="skeleton h-28 w-full rounded-2xl" />
              <div className="skeleton h-28 w-full rounded-2xl" />
            </div>
          ) : (
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
                      {greetingDate}
                    </p>
                  </div>
                  <p className="text-xs font-light tracking-wide text-[#6e7564] mb-0.5">{greeting}</p>
                  <div className="flex items-center gap-2 pb-1">
                    <h2 className="greet-name min-w-0 truncate text-3xl font-black leading-none">{user.name || "אלוף"}</h2>
                    {streak >= 2 && (
                      <span className="shrink-0 rounded-full border border-[#c3f400]/25 bg-black/30 px-2.5 py-1 text-[11px] font-bold text-[#c3f400] shadow-[0_0_14px_rgba(195,244,0,0.08)] backdrop-blur-sm">
                        🔥 {streak} ימים ברצף
                      </span>
                    )}
                  </div>
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
                compact
                analyzing={analyzing}
                aiResult={aiResult}
                foodError={foodError}
                mealSaved={mealSaved}
                estimatingIndex={estimatingIndex}
                analyzeFood={analyzeFood}
                logMeal={logMeal}
                lastSavedMealId={lastSavedMealId}
                sharingMeal={sharingMeal}
                shareMealError={shareMealError}
                mealShared={mealShared}
                sharePromptDismissed={sharePromptDismissed}
                shareMealToGroup={shareMealToGroup}
                dismissSharePrompt={dismissSharePrompt}
                resetAiResult={resetAiResult}
                updateItemName={updateItemName}
                updateItemCalories={updateItemCalories}
                updateItemGrams={updateItemGrams}
                estimateItemNutrition={estimateItemNutrition}
                deleteItem={deleteItem}
                addItem={addItem}
              />
            </motion.div>

            <MealHistory
              meals={myMeals}
              title="הארוחות האחרונות"
              loading={loadingMeals && !mealsLoaded}
              onDelete={deleteMeal}
              compact
              maxDays={3}
              onShowAll={() => setTab("food")}
            />

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <TiltCard className="flex flex-col items-center glass-card rounded-2xl p-6 transition-all" delay={0.3} max={10}>
                <ProgressRing pct={stepsPct} size={88} stroke={8} color="#6366f1" track="#333535">
                  <AnimatedScore value={todaySteps} animate={!prefersReducedMotion} className="text-xl font-bold text-white" />
                  <span className="mt-0.5 text-xs font-normal text-[#c4c9ac]">צעדים</span>
                </ProgressRing>
                <p className="mt-4 text-sm font-semibold tracking-wide text-[#c4c9ac]">צעדים</p>
              </TiltCard>

              <TiltCard className="flex flex-col justify-between glass-card rounded-2xl p-6 transition-all" delay={0.4} max={10}>
                <p className="text-xs font-semibold text-[#8e9379] tracking-widest uppercase">משקל</p>
                {latestWeight ? (
                  <div className="mt-2 space-y-3">
                    <div className="flex items-baseline gap-1">
                      <AnimatedScore
                        value={latestWeight}
                        animate={!prefersReducedMotion}
                        precision={Number.isInteger(latestWeight) ? 0 : 1}
                        format={(value) => value.toLocaleString("he-IL", { maximumFractionDigits: 1 })}
                        className="text-4xl font-black leading-none text-white"
                      />
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
              animate={waterGoalPulse ? {
                scale: [1, 1.035, 1],
                boxShadow: ["0 0 0 rgba(195,244,0,0)", "0 0 26px rgba(195,244,0,0.22)", "0 0 0 rgba(195,244,0,0)"],
              } : { scale: 1, boxShadow: "0 0 0 rgba(195,244,0,0)" }}
              transition={{ duration: waterGoalPulse ? 0.6 : 0, ease: "easeInOut" }}
              onAnimationComplete={() => {
                if (waterGoalPulse) setWaterGoalPulse(false);
              }}
              className="rounded-2xl"
            >
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
                  <AnimatedScore value={todayCaloriesConsumed} animate={!prefersReducedMotion} className="text-3xl font-bold text-[#c3f400]" />
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

          </div>
          )
        )}


        {/* FOOD TAB */}
        {tab === "food" && (
          !showFoodContent ? (
            <div className="space-y-4 pt-3">
              <div className="skeleton h-28 w-full rounded-2xl" />
              <div className="skeleton h-12 w-full rounded-xl" />
              <div className="skeleton h-40 w-full rounded-2xl" />
            </div>
          ) : (
          <div className="space-y-4">
            <QuickMealLogger onSaved={() => {
              loadHome();
              loadMyMeals(true);
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
                  await fetch("/api/users/goals", { method: "POST", headers: await withCsrf({ "Content-Type": "application/json" }), body: JSON.stringify({ daily_calories: cal }) });
                  loadHome();
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
            {proteinGoal && <p className="text-xs text-[#8e9379]">יעד חלבון: {proteinGoal} גרם ביום</p>}

            <MealHistory meals={myMeals} loading={loadingMeals} onDelete={deleteMeal} />
          </div>
          )
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
          !showWeightContent ? (
            <div className="space-y-4 pt-3">
              <div className="skeleton h-48 w-full rounded-2xl" />
              <div className="skeleton h-40 w-full rounded-2xl" />
            </div>
          ) : (
          <div className="space-y-6">

            {(() => {
              const startW = weightLogs[weightLogs.length - 1]?.weight_kg ?? null;

              return (
                <>
                  {weightTarget && weightLogs.length > 0 && (
                    <WeightJourney
                      currentWeight={latestWeight}
                      targetWeight={weightTarget}
                      weightLogs={weightLogs}
                      startingWeight={startW ?? latestWeight ?? 0}
                    />
                  )}
                </>
              );
            })()}

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
                onClick={handleSaveWeight}
                disabled={savingWeight || !newWeight}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="w-full mt-4 rounded-full bg-[#c3f400] py-3 font-bold text-[#161e00] disabled:opacity-50 transition-all"
              >
                {savingWeight ? "שומר..." : "✅ עדכן"}
              </motion.button>
            </motion.div>
          </div>
          )
        )}

        {/* STEPS / COMPETITION TAB */}
        {tab === "steps" && (() => {
          if (!showStepsContent) {
            return (
              <div className="space-y-4 pt-3">
                <div className="flex items-end justify-between">
                  <div className="space-y-2">
                    <div className="skeleton h-8 w-40 rounded-lg" />
                    <div className="skeleton h-3 w-24 rounded" />
                  </div>
                  <div className="skeleton h-10 w-28 rounded-xl" />
                </div>
                <div className="skeleton h-16 w-full rounded-2xl" />
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
              </div>
            );
          }
          const sorted = sortedLeaderboard;
          const myEntry = myLeaderboardEntry;
          const myRank = myLeaderboardRank;
          const maxVal = leaderboardMaxValue;
          const CROWN = ["#c3f400","#c8c8c8","#c8a951"];
          return (
          <div className="space-y-5">

            {/* Header row */}
            <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between">
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
                <p className="text-xs text-[#8e9379] mt-1">היעד היומי שלך: {stepsGoal.toLocaleString()} צעדים</p>
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
            <motion.div initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
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
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
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
              <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
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
                      initial={prefersReducedMotion ? false : { opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: prefersReducedMotion ? 0 : Math.min(i, 5) * 0.03, duration: prefersReducedMotion ? 0.12 : 0.22 }}
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
                            initial={prefersReducedMotion ? false : { width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: prefersReducedMotion ? 0 : Math.min(i, 5) * 0.03 + 0.12, duration: prefersReducedMotion ? 0.12 : 0.45, ease: [0.25,0.46,0.45,0.94] }}
                          />
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right shrink-0 min-w-[52px]">
                        <p className={`text-base font-black leading-none ${accent ? "" : isMe ? "text-[#c3f400]" : "text-white"}`}
                          style={accent ? { color: accent } : {}}>
                          <AnimatedScore value={val} animate={!prefersReducedMotion && i < 3} />
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
              { id: "chat" as const, icon: "💬", label: "צ׳אט" },
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

      <SuccessToast message={successMessage} onDismiss={() => setSuccessMessage(null)} />
      <MilestoneCelebration
        milestone={milestoneQueue[0] ?? null}
        firstName={user.name.trim().split(/\s+/)[0] || undefined}
        onDismiss={() => setMilestoneQueue((current) => current.slice(1))}
      />
      <ConnectSetup
        notifStatus={notifStatus}
        isPwa={isPwa}
        enableNotifications={enableNotifications}
      />

      {/* Profile modal */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowProfile(false)}>
          <div className="glass-card w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4 border border-[#444933]" dir="rtl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white">הגדרות פרופיל</h2>

            <AvatarPhotoPicker
              name={user.name}
              currentUrl={profileAvatarUrl}
              onUploaded={setProfileAvatarUrl}
            />

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
