'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface WaterLog {
  id: string;
  amount_ml: number;
  logged_at: string;
}

interface WaterHistoryProps {
  logs: WaterLog[];
  onDelete: (id: string) => Promise<boolean>;
  onUndo: (log: WaterLog) => Promise<boolean>;
}

export function WaterHistory({ logs, onDelete, onUndo }: WaterHistoryProps) {
  const [deletedLog, setDeletedLog] = useState<{ log: WaterLog; time: number } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (log: WaterLog) => {
    setDeletingId(log.id);
    const success = await onDelete(log.id);
    setDeletingId(null);

    if (success) {
      setDeletedLog({ log, time: Date.now() });
      setTimeout(() => setDeletedLog(null), 5000);
    }
  };

  const handleUndo = async () => {
    if (deletedLog) {
      await onUndo(deletedLog.log);
      setDeletedLog(null);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (logs.length === 0 && !deletedLog) {
    return (
      <motion.div
        className="text-center py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <p className="text-neutral-500 dark:text-neutral-400">
          עדיין לא שתה היום. בואו נתחיל! 💧
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="rounded-3xl shadow-lg overflow-hidden bg-white dark:bg-neutral-800"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
    >
      <div className="max-h-64 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {logs.map((log, index) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className="flex flex-row-reverse items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
            >
              <div className="flex flex-row-reverse items-center gap-3 flex-1">
                <div className="text-2xl">💧</div>
                <div className="text-right">
                  <p className="font-semibold text-neutral-900 dark:text-white">
                    {log.amount_ml} מ"ל
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {formatTime(log.logged_at)}
                  </p>
                </div>
              </div>

              <motion.button
                onClick={() => handleDelete(log)}
                disabled={deletingId === log.id}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/20 p-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {deletingId === log.id ? (
                  <div className="w-4 h-4 border-2 border-danger-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  '✕'
                )}
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Undo Toast */}
      <AnimatePresence>
        {deletedLog && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-danger-50 dark:bg-danger-500/20 border-t border-danger-200 dark:border-danger-500/30 px-4 py-3 flex flex-row-reverse items-center justify-between"
          >
            <button
              onClick={handleUndo}
              className="text-danger-600 dark:text-danger-400 font-semibold hover:underline text-sm"
            >
              ↶ בטל
            </button>
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              {deletedLog.log.amount_ml} מ"ל הוסרו
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
