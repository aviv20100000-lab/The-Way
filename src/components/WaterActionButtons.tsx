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
      <motion.button
        onClick={() => handleAddWater(500)}
        disabled={loading || loadingAmount !== null}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full h-12 rounded-full bg-[#c3f400] text-[#161e00] font-bold disabled:opacity-50 transition-all mb-4 flex items-center justify-center gap-2 shadow-[0_0_30px_-8px_rgba(195,244,0,0.4)]"
      >
        {loadingAmount === 500 ? (
          <div className="w-4 h-4 border-2 border-[#161e00] border-t-transparent rounded-full animate-spin" />
        ) : (
          <>🥤 חצי ליטר</>
        )}
      </motion.button>

      <div className="grid grid-cols-3 gap-3">
        {([200, 1000] as const).map((amt) => (
          <motion.button
            key={amt}
            onClick={() => handleAddWater(amt)}
            disabled={loading || loadingAmount !== null}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="h-10 glass-card border border-[#444933] hover:border-[#38bdf8]/50 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {loadingAmount === amt ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            ) : (
              amt === 200 ? '☕ כוס (200מ"ל)' : '1 ליטר'
            )}
          </motion.button>
        ))}

        <motion.button
          onClick={() => setShowCustom(!showCustom)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="h-10 glass-card border border-[#444933] hover:border-[#38bdf8]/50 text-[#c4c9ac] font-semibold rounded-xl text-sm transition-all"
        >
          ⚙️ מותאם
        </motion.button>
      </div>

      {showCustom && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex gap-2"
        >
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="כמות במ״ל"
            min="1"
            max="5000"
            className="flex-1 px-3 py-2 rounded-xl border border-[#444933] bg-[#282a2b] text-white placeholder:text-[#8e9379] text-sm focus:ring-2 focus:ring-[#38bdf8]/30 focus:border-[#38bdf8] transition-all"
          />
          <motion.button
            onClick={handleCustomSubmit}
            disabled={!customAmount || loading || loadingAmount !== null}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 rounded-full bg-[#c3f400] text-[#161e00] font-bold text-sm transition-all disabled:opacity-50"
          >
            הוסף
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
