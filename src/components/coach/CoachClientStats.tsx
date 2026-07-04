'use client';

import { motion } from 'framer-motion';

interface ClientSummary {
  weights: { weight_kg: number; logged_at: string }[];
  steps_today: number;
  water_today: number;
  meals: { id: string; total_calories: number; logged_at: string; items: unknown[] }[];
  goals: { target_weight_kg: number | null; daily_calories: number | null; daily_water_ml: number; daily_steps: number | null };
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

  const stepsGoal = data.goals.daily_steps ?? 10000;
  const stepsPercent = Math.min(100, (data.steps_today / stepsGoal) * 100).toFixed(0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-white">{clientName}</h3>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Weight */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="glass-card rounded-xl border border-[#2e3030] p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#c4c9ac]">משקל</span>
            {weightLost !== '0' && (
              <span className="text-xs font-bold text-[#c3f400]">↓ {weightLost}kg</span>
            )}
          </div>
          <p className="text-2xl font-bold text-white">{latestWeight ?? '-'} ק"ג</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#282a2b]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${weightProgress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-[#c3f400]"
            />
          </div>
          <p className="mt-1 text-xs text-[#8e9379]">{weightProgress}% לטרגט</p>
        </motion.div>

        {/* Calories */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl border border-[#2e3030] p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#c4c9ac]">קלוריות</span>
            <span className="text-xs font-bold text-white">{caloriestoday}</span>
          </div>
          <p className="text-2xl font-bold text-white">{caloriesPercent}%</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#282a2b]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${caloriesPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-orange-500"
            />
          </div>
          <p className="mt-1 text-xs text-[#8e9379]">יעד: {calorieGoal}</p>
        </motion.div>

        {/* Water */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="glass-card rounded-xl border border-[#2e3030] p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#c4c9ac]">מים</span>
            <span className="text-xs font-bold text-white">{data.water_today}ml</span>
          </div>
          <p className="text-2xl font-bold text-white">{waterPercent}%</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#282a2b]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${waterPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-[#38bdf8]"
            />
          </div>
          <p className="mt-1 text-xs text-[#8e9379]">יעד: {data.goals.daily_water_ml}ml</p>
        </motion.div>

        {/* Steps */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl border border-[#2e3030] p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#c4c9ac]">צעדים</span>
            <span className="text-xs font-bold text-white">{(data.steps_today / 1000).toFixed(1)}K</span>
          </div>
          <p className="text-2xl font-bold text-white">{stepsPercent}%</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#282a2b]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stepsPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-[#c3f400]"
            />
          </div>
          <p className="mt-1 text-xs text-[#8e9379]">יעד: {stepsGoal.toLocaleString()} צעדים</p>
        </motion.div>
      </div>

      {/* Recent Meals */}
      {data.meals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card rounded-xl border border-[#2e3030] p-4"
        >
          <h4 className="mb-3 text-sm font-semibold text-white">ארוחות אחרונות</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {data.meals.slice(0, 3).map((meal) => (
              <div key={meal.id} className="flex items-center justify-between text-sm">
                <span className="text-[#8e9379]">
                  {new Date(meal.logged_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-semibold text-white">{meal.total_calories} קל'</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
