import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e5ecff',
          200: '#d0daff',
          300: '#b0beff',
          400: '#8fa3ff',
          500: '#6b7bff',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#2e1065',
        },
        accent: {
          400: '#06b6d4',
          500: '#0891b2',
          600: '#0e7490',
        },
        success: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        danger: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
    },
  },
  plugins: [],
};

export default config;
