'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface WaterActionButtonsProps {
  onAddWater: (amount: number) => Promise<boolean>;
  loading?: boolean;
}

export function WaterActionButtons({ onAddWater, loading = false }: WaterActionButtonsProps) {
  const [customAmount, setCustomAmount] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [loadingAmount, setLoadingAmount] = useState<number | null>(null);

  const handleAddWater = async (amount: number) => {
    setLoadingAmount(amount);
    await onAddWater(amount);
    setLoadingAmount(null);
  };

  const handleCustomSubmit = async () => {
    const amount = parseInt(customAmount);
    if (amount > 0 && amount <= 5000) {
      await handleAddWater(amount);
      setCustomAmount('');
      setShowCustom(false);
    }
  };

  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      {/* Primary Button */}
      <motion.button
        onClick={() => handleAddWater(500)}
        disabled={loading || loadingAmount !== null}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="w-full h-12 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 dark:from-indigo-500 dark:to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-4 flex items-center justify-center gap-2"
      >
        {loadingAmount === 500 ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            🥤 שתיתי 500 מ"ל
          </>
        )}
      </motion.button>

      {/* Quick Add Buttons */}
      <div className="grid grid-cols-3 gap-3">
        <motion.button
          onClick={() => handleAddWater(250)}
          disabled={loading || loadingAmount !== null}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="h-10 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-900 dark:text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50"
        >
          {loadingAmount === 250 ? (
            <div className="w-3 h-3 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto" />
          ) : (
            '250 מ"ל'
          )}
        </motion.button>

        <motion.button
          onClick={() => handleAddWater(1000)}
          disabled={loading || loadingAmount !== null}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="h-10 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-900 dark:text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50"
        >
          {loadingAmount === 1000 ? (
            <div className="w-3 h-3 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto" />
          ) : (
            '1 ליטר'
          )}
        </motion.button>

        <motion.button
          onClick={() => setShowCustom(!showCustom)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="h-10 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-indigo-600 dark:text-indigo-400 font-semibold rounded-xl text-sm border border-indigo-200 dark:border-indigo-400/30 transition-all"
        >
          ⚙️ מותאם
        </motion.button>
      </div>

      {/* Custom Input */}
      {showCustom && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mt-3 flex gap-2"
        >
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder={'כמות במ״ל'}
            min="1"
            max="5000"
            className="flex-1 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <motion.button
            onClick={handleCustomSubmit}
            disabled={!customAmount || loading || loadingAmount !== null}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50"
          >
            הוסף
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
