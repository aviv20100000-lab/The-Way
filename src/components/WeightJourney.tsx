'use client';

import { motion } from 'framer-motion';
import ProgressRing from './ProgressRing';

interface WeightLog {
  id: string;
  weight_kg: number;
  logged_at: string;
}

interface WeightJourneyProps {
  currentWeight: number | null;
  targetWeight: number;
  weightLogs: WeightLog[];
  startingWeight: number;
}

export function WeightJourney({
  currentWeight,
  targetWeight,
  weightLogs,
  startingWeight,
}: WeightJourneyProps) {
  // Calculate progress
  const totalToLose = startingWeight - targetWeight;
  const alreadyLost = startingWeight - (currentWeight || startingWeight);
  const progressPercent = totalToLose > 0 ? Math.max(0, Math.min(100, (alreadyLost / totalToLose) * 100)) : 0;

  // Determine milestone
  const milestone =
    progressPercent >= 100 ? '🏆'
    : progressPercent >= 50 ? '🔥'
    : progressPercent >= 25 ? '💪'
    : '🏃';

  return (
    <div className="space-y-6">
      {/* Progress Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 p-6 border border-emerald-200 dark:border-emerald-800"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">📉 גרף ירידה במשקל</h3>
          <span className="text-2xl">{milestone}</span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-3">
          <div className="relative h-3 rounded-full bg-emerald-200 dark:bg-emerald-700 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
            />
          </div>

          {/* Progress Text */}
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-bold text-emerald-900 dark:text-emerald-100">{progressPercent.toFixed(0)}%</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                {alreadyLost > 0 ? `${alreadyLost.toFixed(1)} ק"ג` : 'התחלה'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-emerald-600 dark:text-emerald-400">עוד {Math.max(0, totalToLose - alreadyLost).toFixed(1)} ק"ג</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">למטרה: {targetWeight} ק"ג</p>
            </div>
          </div>
        </div>

        {/* Runner Animation */}
        <motion.div
          className="mt-6 flex items-center justify-between px-2"
        >
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{startingWeight}</span>
          <motion.span
            animate={{ x: `${(progressPercent / 100) * 80}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="text-2xl"
          >
            🏃
          </motion.span>
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{targetWeight}</span>
        </motion.div>
      </motion.div>

      {/* Weight History Chart (simplified) */}
      {weightLogs.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-white dark:bg-neutral-800 p-5 shadow-card"
        >
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">היסטוריה</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {weightLogs.slice(0, 10).map((log, idx) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-neutral-600 dark:text-neutral-400">
                  {new Date(log.logged_at).toLocaleDateString('he-IL', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">{log.weight_kg} ק"ג</span>
                {idx > 0 && (
                  <span
                    className={`text-xs font-bold ${
                      log.weight_kg < weightLogs[idx - 1].weight_kg
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {log.weight_kg < weightLogs[idx - 1].weight_kg ? '▼' : '▲'}{' '}
                    {Math.abs(log.weight_kg - weightLogs[idx - 1].weight_kg).toFixed(1)}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Milestone Messages */}
      {progressPercent >= 100 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5 }}
          className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-center text-white"
        >
          <p className="text-3xl mb-2">🎉</p>
          <p className="font-bold text-lg">הגעת למטרה!</p>
          <p className="text-sm opacity-90 mt-1">מזל טוב על ההצלחה!</p>
        </motion.div>
      )}
      {progressPercent >= 50 && progressPercent < 100 && (
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-xl bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 px-4 py-3 text-sm text-orange-900 dark:text-orange-100"
        >
          <p className="font-semibold">🔥 חצי הדרך!</p>
          <p className="text-xs opacity-75 mt-1">אתה באמצע הדרך למטרה שלך - המשך ככה!</p>
        </motion.div>
      )}
      {progressPercent >= 25 && progressPercent < 50 && (
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100"
        >
          <p className="font-semibold">💪 התחלה מוצלחת!</p>
          <p className="text-xs opacity-75 mt-1">אתה בדרך הנכונה - עוד קצת ואתה בחצי הדרך!</p>
        </motion.div>
      )}
    </div>
  );
}
