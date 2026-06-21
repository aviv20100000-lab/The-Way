'use client';

import { useState, useEffect } from 'react';
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
    error,
    addWater,
    deleteWater,
    undoDelete,
    getMotivationText,
  } = useWaterTracker();

  const [celebrating, setCelebrating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

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

  const motivationText = getMotivationText();

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
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
          className="mb-8"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-display-lg font-black text-neutral-900 dark:text-white text-right">
            עומק הביצה
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-right mt-1">
            עקוב אחרי שתיית המיים שלך היום
          </p>
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
        {loading ? (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="h-80 bg-neutral-200 dark:bg-neutral-700 rounded-3xl animate-pulse" />
            <div className="h-32 bg-neutral-200 dark:bg-neutral-700 rounded-3xl animate-pulse" />
            <div className="h-24 bg-neutral-200 dark:bg-neutral-700 rounded-3xl animate-pulse" />
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
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-3 text-right">
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
