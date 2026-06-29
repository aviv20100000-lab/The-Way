'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWaterTracker } from '@/hooks/useWaterTracker';
import { WaterHeroImage } from '@/components/WaterHeroImage';
import { WaterProgressCard } from '@/components/WaterProgressCard';
import { WaterActionButtons } from '@/components/WaterActionButtons';
import { WaterMotivation } from '@/components/WaterMotivation';
import { WaterHistory } from '@/components/WaterHistory';

export default function WaterTrackerPage() {
  const {
    waterLogs,
    waterTotal,
    waterGoal,
    progressPercent,
    streak,
    loading,
    isLoaded,
    error,
    addWater,
    deleteWater,
    undoDelete,
    getMotivationText,
    loadWaterData,
  } = useWaterTracker();

  const [celebrating, setCelebrating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const touchStartY = useRef(0);

  // Celebration effect when goal reached
  useEffect(() => {
    if (progressPercent === 100 && !celebrating) {
      setCelebrating(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
    } else if (progressPercent < 100) {
      setCelebrating(false);
    }
  }, [progressPercent, celebrating]);

  useEffect(() => {
    if (!isLoaded) {
      setShowContent(false);
      return;
    }
    const timeout = setTimeout(() => setShowContent(true), 120);
    return () => clearTimeout(timeout);
  }, [isLoaded]);

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setPullDistance(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const distance = currentY - touchStartY.current;

    if (distance > 0 && window.scrollY === 0) {
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 80) {
      setRefreshing(true);
      await loadWaterData();
      setRefreshing(false);
    }
    setPullDistance(0);
  };

  const motivationText = getMotivationText();

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0c0f0f" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-Refresh Indicator */}
      {pullDistance > 0 && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center"
          style={{ height: pullDistance }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="text-4xl"
            animate={{
              rotate: refreshing ? 360 : (pullDistance / 80) * 360,
            }}
            transition={{ duration: refreshing ? 1 : 0, repeat: refreshing ? Infinity : 0 }}
          >
            {refreshing ? '⚙️' : '⬇️'}
          </motion.div>
        </motion.div>
      )}

      {/* Confetti Animation */}
      <AnimatePresence>
        {showConfetti &&
          Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              className="fixed pointer-events-none"
              initial={{
                x: `calc(50vw + ${(Math.random() - 0.5) * 100}px)`,
                y: '50vh',
                opacity: 1,
              }}
              animate={{
                x: `calc(50vw + ${(Math.random() - 0.5) * 200}px)`,
                y: '10vh',
                opacity: 0,
                rotate: Math.random() * 360,
              }}
              transition={{
                duration: 2,
                ease: 'easeOut',
              }}
            >
              <div className="text-2xl">
                {['🎉', '✨', '🌟', '💧'][Math.floor(Math.random() * 4)]}
              </div>
            </motion.div>
          ))}
      </AnimatePresence>

      {/* Main Content */}
      <div className="max-w-lg mx-auto px-5 py-6">
        {/* Header */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <style>{`
            @keyframes waterShimmer {
              0%   { background-position: 0% center; }
              50%  { background-position: 100% center; }
              100% { background-position: 0% center; }
            }
            @keyframes titleFloat {
              0%, 100% { transform: translateY(0px); }
              50%       { transform: translateY(-10px); }
            }
            .water-title {
              background: linear-gradient(135deg, #ffffff 0%, #38bdf8 40%, #c3f400 80%, #38bdf8 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              background-size: 200% auto;
              animation: waterShimmer 4s ease-in-out infinite, titleFloat 4s ease-in-out infinite;
            }
          `}</style>
          <h1 className="water-title text-3xl font-black text-center">
            שתייה יומית
          </h1>
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.div
            className="mb-4 p-4 bg-danger-50 dark:bg-danger-500/20 border border-danger-200 dark:border-danger-500/30 rounded-xl text-danger-600 dark:text-danger-400 text-sm"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {error}
          </motion.div>
        )}

        {/* Loading State */}
        {loading || !showContent ? (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="h-80 bg-[#1e2020] rounded-3xl animate-pulse" />
            <div className="h-32 bg-[#1e2020] rounded-3xl animate-pulse" />
            <div className="h-24 bg-[#1e2020] rounded-3xl animate-pulse" />
          </motion.div>
        ) : (
          <>
            {/* Hero Image */}
            <WaterHeroImage />

            {/* Progress Card */}
            <WaterProgressCard
              waterTotal={waterTotal}
              waterGoal={waterGoal}
              progressPercent={progressPercent}
              celebratingReachGoal={celebrating}
            />

            {/* Action Buttons */}
            <WaterActionButtons
              onAddWater={addWater}
              loading={false}
            />

            {/* Motivation */}
            <WaterMotivation
              motivationText={motivationText}
              currentStreak={streak.current_streak}
              bestStreak={streak.best_streak}
              goalReachedToday={celebrating}
            />

            {/* History */}
            <div className="mb-8">
              <h2 className="text-lg font-bold text-white mb-3 text-right">
                היסטוריה
              </h2>
              <WaterHistory
                logs={waterLogs}
                onDelete={deleteWater}
                onUndo={undoDelete}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
