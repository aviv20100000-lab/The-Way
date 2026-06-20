'use client';

import { useTheme } from '@/lib/theme-provider';
import { motion } from 'framer-motion';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="fixed bottom-4 start-4 z-50 rounded-full p-3 bg-neutral-100 dark:bg-neutral-800 hover:shadow-lg transition-shadow"
      title={`Dark mode: ${theme === 'dark' ? 'On' : 'Off'}`}
    >
      {theme === 'light' ? (
        <svg className="w-6 h-6 text-neutral-800" fill="currentColor" viewBox="0 0 20 20">
          {/* Moon icon */}
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      ) : (
        <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          {/* Sun icon */}
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.323 1.677a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zm2.646 2.646a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM10 8a2 2 0 100 4 2 2 0 000-4zM2.05 11a1 1 0 011-1h1.414a1 1 0 110 2H3.05a1 1 0 01-1-1zm13.536 0a1 1 0 011-1h1.414a1 1 0 110 2h-1.414a1 1 0 01-1-1zM3.757 16.243a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zm10.606 0a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM10 18a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </motion.button>
  );
}
