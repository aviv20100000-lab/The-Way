'use client';

import { motion } from 'framer-motion';

interface WaterMotivationProps {
  motivationText: string;
  currentStreak: number;
  bestStreak: number;
  goalReachedToday: boolean;
}

export function WaterMotivation({ motivationText, currentStreak, bestStreak, goalReachedToday }: WaterMotivationProps) {
  const showStreak = currentStreak > 0 || goalReachedToday;

  return (
    <motion.div
      className="mb-6 space-y-3"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <motion.div
        key={motivationText}
        className="glass-card rounded-2xl p-5"
        style={{ border: '1px solid #444933' }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-base font-semibold text-[#c4c9ac] italic">{motivationText}</p>
      </motion.div>

      {showStreak && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, type: 'spring', stiffness: 100 }}
          className="flex gap-2 justify-center"
        >
          <div className="rounded-full glass-card border border-[#38bdf8]/30 text-white px-6 py-3 font-bold text-center">
            <motion.span
              animate={goalReachedToday ? { rotate: 360 } : {}}
              transition={{ duration: 1, ease: 'easeInOut' }}
              className="inline-block mr-1"
            >
              🔥
            </motion.span>
            {currentStreak} ימים ברצף!
          </div>
        </motion.div>
      )}

      {bestStreak > 0 && (
        <p className="text-center text-sm text-[#8e9379]">
          סדרה הטובה ביותר: {bestStreak} ימים 💪 (יא כאוב!)
        </p>
      )}
    </motion.div>
  );
}
