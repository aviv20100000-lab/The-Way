'use client';

import { motion } from 'framer-motion';
import ProgressRing from './ProgressRing';

interface WaterProgressCardProps {
  waterTotal: number;
  waterGoal: number;
  progressPercent: number;
  celebratingReachGoal: boolean;
}

export function WaterProgressCard({
  waterTotal,
  waterGoal,
  progressPercent,
  celebratingReachGoal,
}: WaterProgressCardProps) {
  return (
    <motion.div
      className={`rounded-3xl shadow-lg mb-6 p-6 bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-neutral-800 dark:to-neutral-700 ${
        celebratingReachGoal ? 'ring-2 ring-emerald-400 shadow-emerald-400/30' : ''
      }`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <div className="flex flex-row-reverse items-center justify-center gap-8">
        {/* Progress Ring */}
        <motion.div
          animate={
            celebratingReachGoal
              ? {
                  boxShadow: [
                    '0 0 0 0 rgba(16, 185, 129, 0.7)',
                    '0 0 0 10px rgba(16, 185, 129, 0)',
                  ],
                }
              : {}
          }
          transition={
            celebratingReachGoal
              ? { duration: 0.6, repeat: 3, ease: 'easeOut' }
              : {}
          }
          className="flex-shrink-0"
        >
          <ProgressRing
            radius={50}
            circumference={2 * Math.PI * 50}
            strokeDashoffset={2 * Math.PI * 50 * (1 - progressPercent / 100)}
            percentage={progressPercent}
            size={120}
            strokeWidth={10}
            color={celebratingReachGoal ? '#10b981' : '#06b6d4'}
          />
        </motion.div>

        {/* Text Content */}
        <div className="text-right">
          <motion.div
            key={waterTotal}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 100 }}
          >
            <p className="text-4xl font-black text-neutral-900 dark:text-white">
              {waterTotal}
            </p>
          </motion.div>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 font-semibold">
            מ"ל / {waterGoal}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {progressPercent}% מהיעד
          </p>
        </div>
      </div>
    </motion.div>
  );
}
