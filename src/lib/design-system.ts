/**
 * THE WAY — Design System
 * World-class design tokens for a premium fitness & nutrition app
 * Tailored for ages ~30, accessible, sophisticated
 */

export const colors = {
  primary: {
    50: "#f0f4ff",
    100: "#e5ecff",
    200: "#d0daff",
    300: "#b0beff",
    400: "#8fa3ff",
    500: "#6b7bff",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#2e1065",
  },
  accent: {
    400: "#06b6d4",
    500: "#0891b2",
    600: "#0e7490",
  },
  success: {
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
  },
  danger: {
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
  },
  neutral: {
    0: "#ffffff",
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
  },
};

export const typography = {
  fontFamily: {
    base: "'Rubik', system-ui, -apple-system, sans-serif",
    mono: "'Courier New', monospace",
  },
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const spacing = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
  32: "8rem",
};

export const shadows = {
  xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  sm: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
  /* Premium shadows */
  glow: "0 0px 20px rgba(79, 70, 229, 0.1)",
  floating: "0 10px 30px -10px rgba(0, 0, 0, 0.2)",
  card: "0 2px 18px -10px rgba(0, 0, 0, 0.18), 0 0px 1px rgba(0, 0, 0, 0.03)",
  elevated: "0 4px 20px -4px rgba(0, 0, 0, 0.15)",
};

export const borderRadius = {
  none: "0",
  sm: "0.375rem",
  base: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  full: "9999px",
};

export const transitions = {
  fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
  base: "250ms cubic-bezier(0.4, 0, 0.2, 1)",
  slow: "350ms cubic-bezier(0.4, 0, 0.2, 1)",
  /* Spring-like easing for premium feel */
  spring: "250ms cubic-bezier(0.175, 0.885, 0.32, 1.275)",
};

export const breakpoints = {
  xs: "320px",
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
};

/**
 * Component Presets — reusable style combinations
 */
export const components = {
  button: {
    base: "inline-flex items-center justify-center font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
    variants: {
      primary: "bg-primary-600 text-white hover:bg-primary-700 active:scale-95",
      secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:scale-95",
      ghost: "text-primary-600 hover:bg-primary-50 active:scale-95",
    },
    sizes: {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
      lg: "px-6 py-3 text-lg",
    },
  },
  card: {
    base: "rounded-2xl bg-white shadow-card ring-1 ring-black/[0.03] overflow-hidden",
    interactive: "rounded-2xl bg-white shadow-card ring-1 ring-black/[0.03] overflow-hidden hover:shadow-floating transition-shadow duration-300",
  },
  input: {
    base: "rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900 transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500",
  },
};
