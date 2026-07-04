'use client';

import { motion } from 'framer-motion';
import ProgressRing from './ProgressRing';

interface WaterProgressCardProps {
  waterTotal: number;
  waterGoal: number;
  progressPercent: number;
  celebratingReachGoal: boolean;
}

export function WaterProgressCard({ waterTotal, waterGoal, progressPercent, celebratingReachGoal }: WaterProgressCardProps) {
  return (
    <motion.div
      className="glass-card rounded-3xl mb-6 p-6"
      style={{ border: celebratingReachGoal ? '1px solid rgba(56,189,248,0.5)' : '1px solid #444933' }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <div className="flex flex-row-reverse items-center justify-center gap-8">
        <motion.div
          animate={celebratingReachGoal ? { boxShadow: ['0 0 0 0 rgba(56,189,248,0.7)', '0 0 0 10px rgba(56,189,248,0)'] } : {}}
          transition={celebratingReachGoal ? { duration: 0.6, repeat: 3, ease: 'easeOut' } : {}}
          className="flex-shrink-0"
        >
          <ProgressRing
            pct={progressPercent}
            size={120}
            stroke={10}
            color={celebratingReachGoal ? '#c3f400' : '#38bdf8'}
            track="#333535"
          />
        </motion.div>

        <div className="text-right">
          <motion.div
            key={waterTotal}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 100 }}
          >
            <p className="text-4xl font-black text-white">{waterTotal}</p>
          </motion.div>
          <p className="text-sm text-[#c4c9ac] font-semibold">מ"ל / {waterGoal}</p>
          <p className="text-xs text-[#8e9379] mt-1">{progressPercent}% מהיעד</p>
        </div>
      </div>
    </motion.div>
  );
}
