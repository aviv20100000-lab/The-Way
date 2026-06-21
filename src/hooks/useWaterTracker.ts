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

export function useWaterTracker() {
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [waterTotal, setWaterTotal] = useState(0);
  const [waterGoal, setWaterGoal] = useState(2000);
  const [streak, setStreak] = useState<StreakData>({
    current_streak: 0,
    last_completed_date: null,
    best_streak: 0,
    goal_reached_today: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [undoStack, setUndoStack] = useState<Array<{ log: WaterLog; timestamp: number }>>([]);

  // Load water data
  const loadWaterData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [waterRes, streakRes] = await Promise.all([
        fetch('/api/health/water'),
        fetch('/api/health/water/streak'),
      ]);

      if (!waterRes.ok || !streakRes.ok) throw new Error('Failed to fetch data');

      const waterData = await waterRes.json();
      const streakData = await streakRes.json();

      setWaterLogs(waterData.logs || []);
      setWaterTotal(waterData.total || 0);
      setWaterGoal(waterData.goal || 2000);
      setStreak(streakData);
    } catch (err) {
      console.error('Error loading water data:', err);
      setError('Failed to load water data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Add water
  const addWater = useCallback(
    async (amount_ml: number): Promise<boolean> => {
      try {
        const res = await fetch('/api/health/water', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        setWaterLogs((prev) => [newLog, ...prev]);
        setWaterTotal((prev) => prev + amount_ml);

        // Check if goal reached
        const newTotal = waterTotal + amount_ml;
        if (newTotal >= waterGoal && !streak.goal_reached_today) {
          // Refetch streak to update
          const streakRes = await fetch('/api/health/water/streak');
          if (streakRes.ok) {
            const newStreak = await streakRes.json();
            setStreak(newStreak);
          }
        }

        return true;
      } catch (err) {
        console.error('Error adding water:', err);
        setError('Failed to add water');
        return false;
      }
    },
    [waterTotal, waterGoal, streak.goal_reached_today]
  );

  // Delete water
  const deleteWater = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const logToDelete = waterLogs.find((log) => log.id === id);
        if (!logToDelete) return false;

        // Optimistic update - add to undo stack
        setWaterLogs((prev) => prev.filter((log) => log.id !== id));
        setWaterTotal((prev) => prev - logToDelete.amount_ml);
        setUndoStack((prev) => [
          { log: logToDelete, timestamp: Date.now() },
          ...prev.slice(0, 4), // Keep last 5 undos
        ]);

        // Make API call
        const res = await fetch(`/api/health/water/${id}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          // Revert on error
          setWaterLogs((prev) => [logToDelete, ...prev].sort(
            (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
          ));
          setWaterTotal((prev) => prev + logToDelete.amount_ml);
          throw new Error('Failed to delete water');
        }

        return true;
      } catch (err) {
        console.error('Error deleting water:', err);
        setError('Failed to delete water');
        return false;
      }
    },
    [waterLogs]
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
    error,
    undoStack,
    addWater,
    deleteWater,
    undoDelete,
    loadWaterData,
    getMotivationText,
  };
}
