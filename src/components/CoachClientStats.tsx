'use client';

import { motion } from 'framer-motion';

interface ClientSummary {
  weights: { weight_kg: number; logged_at: string }[];
  steps_today: number;
  water_today: number;
  meals: { id: string; total_calories: number; logged_at: string; items: unknown[] }[];
  goals: { target_weight_kg: number | null; daily_calories: number | null; daily_water_ml: number };
}

interface CoachClientStatsProps {
  clientName: string;
  data: ClientSummary;
}

export function CoachClientStats({ clientName, data }: CoachClientStatsProps) {
  // Calculate weight progress
  const latestWeight = data.weights[0]?.weight_kg ?? null;
  const oldestWeight = data.weights[data.weights.length - 1]?.weight_kg ?? latestWeight;
  const weightLost = latestWeight && oldestWeight ? (oldestWeight - latestWeight).toFixed(1) : '0';
  const targetWeight = data.goals.target_weight_kg;
  const weightProgress = latestWeight && targetWeight ? ((oldestWeight - latestWeight) / (oldestWeight - targetWeight) * 100).toFixed(0) : '0';

  // Calculate calories today
  const caloriestoday = data.meals
    .filter(m => new Date(m.logged_at).toDateString() === new Date().toDateString())
    .reduce((sum, m) => sum + m.total_calories, 0);
  const calorieGoal = data.goals.daily_calories ?? 2000;
  const caloriesPercent = Math.min(100, (caloriestoday / calorieGoal) * 100).toFixed(0);

  // Water progress
  const waterPercent = Math.min(100, (data.water_today / data.goals.daily_water_ml) * 100).toFixed(0);

  // Steps progress (assuming 10k goal)
  const stepsPercent = Math.min(100, (data.steps_today / 10000) * 100).toFixed(0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-black-matte dark:text-neutral-50 mb-4">📊 {clientName}</h3>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Weight */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl bg-white dark:bg-neutral-800 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">⚖️ משקל</span>
            {weightLost !== '0' && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">↓ {weightLost}kg</span>
            )}
          </div>
          <p className="text-2xl font-bold text-black-matte dark:text-neutral-100">{latestWeight ?? '-'} ק"ג</p>
          <div className="mt-2 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${weightProgress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-emerald-500"
            />
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{weightProgress}% לטרגט</p>
        </motion.div>

        {/* Calories */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl bg-white dark:bg-neutral-800 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">🔥 קלוריות</span>
            <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{caloriestoday}</span>
          </div>
          <p className="text-2xl font-bold text-black-matte dark:text-neutral-100">{caloriesPercent}%</p>
          <div className="mt-2 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${caloriesPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-orange-500"
            />
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">יעד: {calorieGoal}</p>
        </motion.div>

        {/* Water */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl bg-white dark:bg-neutral-800 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">💧 מים</span>
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{data.water_today}ml</span>
          </div>
          <p className="text-2xl font-bold text-black-matte dark:text-neutral-100">{waterPercent}%</p>
          <div className="mt-2 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${waterPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-cyan-500"
            />
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">יעד: {data.goals.daily_water_ml}ml</p>
        </motion.div>

        {/* Steps */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl bg-white dark:bg-neutral-800 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">👟 צעדים</span>
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">{(data.steps_today / 1000).toFixed(1)}K</span>
          </div>
          <p className="text-2xl font-bold text-black-matte dark:text-neutral-100">{stepsPercent}%</p>
          <div className="mt-2 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stepsPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-primary-500"
            />
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">יעד: 10K צעדים</p>
        </motion.div>
      </div>

      {/* Recent Meals */}
      {data.meals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl bg-white dark:bg-neutral-800 p-4 shadow-sm"
        >
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">🍽️ ארוחות אחרונות</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {data.meals.slice(0, 3).map((meal) => (
              <div key={meal.id} className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">
                  {new Date(meal.logged_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">{meal.total_calories} קל'</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
