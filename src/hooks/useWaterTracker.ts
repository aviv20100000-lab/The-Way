'use client';

import { useState, useEffect, useCallback } from 'react';

export interface WaterLog {
  id: string;
  amount_ml: number;
  logged_at: string;
}

export interface StreakData {
  current_streak: number;
  last_completed_date: string | null;
  best_streak: number;
  goal_reached_today: boolean;
}

const CACHE_KEY = 'way_water_tracker';

type WaterCache = {
  waterLogs: WaterLog[];
  waterTotal: number;
  waterGoal: number;
  streak: StreakData;
};

function readCache(): WaterCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as WaterCache) : null;
  } catch {
    return null;
  }
}

function writeCache(data: WaterCache) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

export function useWaterTracker() {
  const cached = readCache();
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>(cached?.waterLogs ?? []);
  const [waterTotal, setWaterTotal] = useState(cached?.waterTotal ?? 0);
  const [waterGoal, setWaterGoal] = useState(cached?.waterGoal ?? 2000);
  const [streak, setStreak] = useState<StreakData>(cached?.streak ?? {
    current_streak: 0,
    last_completed_date: null,
    best_streak: 0,
    goal_reached_today: false,
  });
  const [loading, setLoading] = useState(cached ? false : true);
  const [isLoaded, setIsLoaded] = useState(cached !== null);
  const [error, setError] = useState('');
  const [undoStack, setUndoStack] = useState<Array<{ log: WaterLog; timestamp: number }>>([]);

  // Load water data
  const loadWaterData = useCallback(async () => {
    try {
      if (!readCache()) setLoading(true);
      setError('');

      const res = await fetch('/api/health/water');
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();

      setWaterLogs(data.logs || []);
      setWaterTotal(data.total || 0);
      setWaterGoal(data.goal || 2000);
      setStreak(data.streak || { current_streak: 0, last_completed_date: null, best_streak: 0, goal_reached_today: false });
      writeCache({
        waterLogs: data.logs || [],
        waterTotal: data.total || 0,
        waterGoal: data.goal || 2000,
        streak: data.streak || { current_streak: 0, last_completed_date: null, best_streak: 0, goal_reached_today: false },
      });
    } catch (err) {
      console.error('Error loading water data:', err);
      setError('Failed to load water data');
    } finally {
      setLoading(false);
      setIsLoaded(true);
    }
  }, []);

  // Add water
  const addWater = useCallback(
    async (amount_ml: number): Promise<boolean> => {
      try {
        const { withCsrf } = await import('@/lib/csrf-client');
        const res = await fetch('/api/health/water', {
          method: 'POST',
          headers: await withCsrf({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ amount_ml }),
        });

        if (!res.ok) throw new Error('Failed to add water');

        const data = await res.json();
        const newLog: WaterLog = {
          id: data.id,
          amount_ml,
          logged_at: data.logged_at,
        };

        // Optimistic update
        const nextLogs = [newLog, ...waterLogs];
        const nextTotal = waterTotal + amount_ml;
        const nextStreak = {
          ...streak,
          goal_reached_today: nextTotal >= waterGoal ? true : streak.goal_reached_today,
        };
        setWaterLogs(nextLogs);
        setWaterTotal(nextTotal);
        setStreak(nextStreak);
        writeCache({
          waterLogs: nextLogs,
          waterTotal: nextTotal,
          waterGoal,
          streak: nextStreak,
        });

        // If goal just reached, refetch combined data to get updated streak
        const newTotal = nextTotal;
        if (newTotal >= waterGoal && !streak.goal_reached_today) {
          const refreshRes = await fetch('/api/health/water');
          if (refreshRes.ok) {
            const refreshed = await refreshRes.json();
            const refreshedStreak = refreshed.streak || streak;
            setStreak(refreshedStreak);
            writeCache({
              waterLogs: nextLogs,
              waterTotal: nextTotal,
              waterGoal,
              streak: refreshedStreak,
            });
          }
        }

        return true;
      } catch (err) {
        console.error('Error adding water:', err);
        setError('Failed to add water');
        return false;
      }
    },
    [waterLogs, waterTotal, waterGoal, streak.goal_reached_today]
  );

  // Delete water
  const deleteWater = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const logToDelete = waterLogs.find((log) => log.id === id);
        if (!logToDelete) return false;

        // Optimistic update - add to undo stack
        const nextLogs = waterLogs.filter((log) => log.id !== id);
        const nextTotal = Math.max(0, waterTotal - logToDelete.amount_ml);
        setWaterLogs(nextLogs);
        setWaterTotal(nextTotal);
        setUndoStack((prev) => [
          { log: logToDelete, timestamp: Date.now() },
          ...prev.slice(0, 4), // Keep last 5 undos
        ]);
        writeCache({
          waterLogs: nextLogs,
          waterTotal: nextTotal,
          waterGoal,
          streak: {
            ...streak,
            goal_reached_today: nextTotal >= waterGoal,
          },
        });

        // Make API call
        const { withCsrf } = await import('@/lib/csrf-client');
        const res = await fetch(`/api/health/water/${id}`, {
          method: 'DELETE',
          headers: await withCsrf(),
        });

        if (!res.ok) {
          // Revert on error
          const revertedLogs = [logToDelete, ...nextLogs].sort(
            (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
          );
          const revertedTotal = nextTotal + logToDelete.amount_ml;
          setWaterLogs(revertedLogs);
          setWaterTotal(revertedTotal);
          writeCache({
            waterLogs: revertedLogs,
            waterTotal: revertedTotal,
            waterGoal,
            streak,
          });
          throw new Error('Failed to delete water');
        }

        return true;
      } catch (err) {
        console.error('Error deleting water:', err);
        setError('Failed to delete water');
        return false;
      }
    },
    [streak, waterGoal, waterLogs, waterTotal]
  );

  // Undo delete
  const undoDelete = useCallback(
    async (index: number): Promise<boolean> => {
      try {
        const { log } = undoStack[index];
        const success = await addWater(log.amount_ml);

        if (success) {
          setUndoStack((prev) => prev.filter((_, i) => i !== index));
        }

        return success;
      } catch (err) {
        console.error('Error undoing delete:', err);
        return false;
      }
    },
    [undoStack, addWater]
  );

  // Get progress percentage
  const progressPercent = Math.min(Math.round((waterTotal / waterGoal) * 100), 100);

  // Get motivation text
  const getMotivationText = (): string => {
    if (progressPercent === 0) return 'התחלה טובה! עוד קצת ויגיע אליך 💪';
    if (progressPercent < 25) return 'התחלה טובה! עוד קצת ויגיע אליך 💪';
    if (progressPercent < 50) return 'באמצע הדרך! המשך בקצב הזה 🔥';
    if (progressPercent < 75) return 'כמעט שם! עוד דחיפה אחרונה 🎯';
    if (progressPercent < 100) return 'כמעט הגעת! מטר אחד עוד ✨';
    return 'כל הכבוד! הגעת למטרה 🎉';
  };

  useEffect(() => {
    loadWaterData();
  }, [loadWaterData]);

  return {
    waterLogs,
    waterTotal,
    waterGoal,
    progressPercent,
    streak,
    loading,
    isLoaded,
    error,
    undoStack,
    addWater,
    deleteWater,
    undoDelete,
    loadWaterData,
    getMotivationText,
  };
}
