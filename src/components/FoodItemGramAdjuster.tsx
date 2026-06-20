'use client';

import { motion } from 'framer-motion';

interface FoodItemGramAdjusterProps {
  itemIndex: number;
  currentGrams: number;
  estimatedGrams: number;
  onChangeGrams: (index: number, newGrams: number) => void;
}

export function FoodItemGramAdjuster({
  itemIndex,
  currentGrams,
  estimatedGrams,
  onChangeGrams,
}: FoodItemGramAdjusterProps) {
  const handleDecrement = () => {
    onChangeGrams(itemIndex, Math.max(5, currentGrams - 10));
  };

  const handleIncrement = () => {
    onChangeGrams(itemIndex, currentGrams + 10);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 5) {
      onChangeGrams(itemIndex, value);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="flex items-center gap-2"
    >
      <motion.button
        onClick={handleDecrement}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="h-9 w-9 rounded-lg bg-white border border-neutral-200 text-lg font-bold text-neutral-700 hover:bg-neutral-50 transition-colors"
        title="הפחת 10 גרם"
      >
        −
      </motion.button>

      <motion.input
        type="number"
        value={currentGrams}
        onChange={handleInputChange}
        whileHover={{ scale: 1.02 }}
        className="h-9 w-16 rounded-lg border border-neutral-200 bg-white text-center font-semibold text-neutral-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
        min="5"
        title={`הקלד גרמים (נוכחי: ${estimatedGrams}g)`}
      />

      <motion.button
        onClick={handleIncrement}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="h-9 w-9 rounded-lg bg-white border border-neutral-200 text-lg font-bold text-neutral-700 hover:bg-neutral-50 transition-colors"
        title="הוסף 10 גרם"
      >
        +
      </motion.button>

      <span className="text-xs text-neutral-500 min-w-fit">
        {estimatedGrams}g
      </span>
    </motion.div>
  );
}
