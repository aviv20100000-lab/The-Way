'use client';

import { motion } from 'framer-motion';

interface WaterMotivationProps {
  motivationText: string;
  currentStreak: number;
  bestStreak: number;
  goalReachedToday: boolean;
}

export function WaterMotivation({
  motivationText,
  currentStreak,
  bestStreak,
  goalReachedToday,
}: WaterMotivationProps) {
  const showStreak = currentStreak > 0 || goalReachedToday;

  return (
    <motion.div
      className="mb-6 space-y-3"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      {/* Motivation Text */}
      <motion.div
        key={motivationText}
        className="rounded-3xl shadow-lg p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-neutral-800 dark:to-neutral-700"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <p className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 italic">
          {motivationText}
        </p>
      </motion.div>

      {/* Streak Badge */}
      {showStreak && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, type: 'spring', stiffness: 100 }}
          className="flex gap-2 justify-center"
        >
          <div className="rounded-full bg-gradient-to-r from-accent-400 to-cyan-500 text-white px-6 py-3 font-bold text-center shadow-lg">
            <motion.div
              animate={goalReachedToday ? { rotate: 360 } : {}}
              transition={{ duration: 1, ease: 'easeInOut' }}
              className="inline-block mr-1"
            >
              🔥
            </motion.div>
            {currentStreak} ימים ברצף!
          </div>
        </motion.div>
      )}

      {/* Best Streak Info */}
      {bestStreak > 0 && (
        <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
          סדרה הטובה ביותר: {bestStreak} ימים 💪 (יא כאוב!)
        </p>
      )}
    </motion.div>
  );
}
