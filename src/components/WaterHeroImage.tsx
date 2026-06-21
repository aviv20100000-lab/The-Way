'use client';

import { motion } from 'framer-motion';

const gradients = [
  'from-cyan-400 via-blue-500 to-indigo-600',
  'from-emerald-400 via-green-500 to-teal-600',
  'from-blue-400 via-cyan-500 to-sky-600',
  'from-indigo-400 via-purple-500 to-pink-600',
  'from-teal-400 via-cyan-500 to-blue-600',
  'from-sky-400 via-blue-500 to-indigo-600',
  'from-cyan-300 via-blue-400 to-purple-600',
  'from-emerald-300 via-teal-500 to-cyan-600',
];

const emojis = ['💧', '💪', '🏃', '⚡', '🎯', '✨', '🔥', '🌟'];

export function WaterHeroImage() {
  const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

  return (
    <motion.div
      className={`relative rounded-3xl overflow-hidden shadow-lg aspect-square w-full mb-6 bg-gradient-to-br ${randomGradient}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40" />

      {/* Center Emoji */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
      >
        <span className="text-9xl">{randomEmoji}</span>
      </motion.div>

      {/* Overlay Text */}
      <motion.div
        className="absolute bottom-4 right-5 text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <p className="text-2xl font-bold">💧 היום</p>
      </motion.div>
    </motion.div>
  );
}
