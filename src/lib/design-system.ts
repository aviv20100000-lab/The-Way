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
    xs: "0.75rem",      // 12px
    sm: "0.875rem",     // 14px
    base: "1rem",       // 16px
    lg: "1.125rem",     // 18px
    xl: "1.25rem",      // 20px
    "2xl": "1.5rem",    // 24px
    "3xl": "1.875rem",  // 30px
    "4xl": "2.25rem",   // 36px
    "5xl": "2.75rem",   // 44px — display-lg
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
    tight: 1.2,        // Headings (Hebrew needs more space than English)
    snug: 1.375,       // Subheadings
    normal: 1.5,       // Body text
    relaxed: 1.75,     // Long-form content
  },
  /* Typography hierarchy for premium feel */
  scales: {
    display: {
      lg: { size: "2.5rem", weight: 900, lineHeight: 1.1, tracking: -0.02 },      // 40px
      base: { size: "2rem", weight: 900, lineHeight: 1.2, tracking: -0.01 },       // 32px
      sm: { size: "1.5rem", weight: 800, lineHeight: 1.3 },                        // 24px
    },
    heading: {
      lg: { size: "1.5rem", weight: 700, lineHeight: 1.3 },                        // 24px
      base: { size: "1.25rem", weight: 700, lineHeight: 1.4 },                     // 20px
      sm: { size: "1.125rem", weight: 600, lineHeight: 1.4 },                      // 18px
    },
    body: {
      lg: { size: "1rem", weight: 500, lineHeight: 1.6 },                          // 16px (emphasized)
      base: { size: "0.875rem", weight: 400, lineHeight: 1.5 },                    // 14px (standard)
      sm: { size: "0.75rem", weight: 400, lineHeight: 1.5 },                       // 12px (small)
    },
    caption: {
      base: { size: "0.75rem", weight: 500, lineHeight: 1.4 },                     // 12px (label)
      muted: { size: "0.75rem", weight: 400, lineHeight: 1.4, color: "text-neutral-500" },
    },
  },
};

export const spacing = {
  0: "0",
  1: "0.25rem",   // 4px — micro
  2: "0.5rem",    // 8px — small
  3: "0.75rem",   // 12px — spacing-item (between related elements)
  4: "1rem",      // 16px — spacing-group (between sections)
  5: "1.25rem",   // 20px — spacing-section (elevated spacing)
  6: "1.5rem",    // 24px — card-padding
  8: "2rem",      // 32px — section-gap
  10: "2.5rem",   // 40px — large
  12: "3rem",     // 48px — very large
  16: "4rem",     // 64px — hero spacing
  20: "5rem",
  24: "6rem",
  32: "8rem",
};

export const shadows = {
  /* Micro-interactions (barely visible) */
  micro: "0 1px 3px rgba(0, 0, 0, 0.08)",

  /* Light depth */
  xs: "0 1px 2px rgba(0, 0, 0, 0.05)",
  sm: "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",

  /* Standard (cards, sections) */
  md: "0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.05)",

  /* Elevated (hover state) */
  lg: "0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)",

  /* Premium floating (modals, overlays) */
  xl: "0 20px 25px rgba(0, 0, 0, 0.12), 0 8px 10px rgba(0, 0, 0, 0.05)",

  /* Premium card shadow (default on cards) */
  card: "0 2px 18px rgba(0, 0, 0, 0.15), 0 0px 1px rgba(0, 0, 0, 0.03)",

  /* Floating/hover elevation (interactive cards) */
  floating: "0 12px 35px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.06)",

  /* Glow/accent (premium moments) */
  glow: "0 0px 30px rgba(79, 70, 229, 0.15), 0 0px 60px rgba(79, 70, 229, 0.08)",

  /* Inset (pressed state) */
  inset: "inset 0 2px 4px rgba(0, 0, 0, 0.06), inset 0 1px 2px rgba(0, 0, 0, 0.03)",
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
  /* Micro-interactions (fast feedback) */
  fast: "100ms cubic-bezier(0.4, 0, 0.2, 1)",

  /* Standard UI changes */
  base: "250ms cubic-bezier(0.4, 0, 0.2, 1)",

  /* Slower, more deliberate */
  slow: "350ms cubic-bezier(0.4, 0, 0.2, 1)",

  /* Spring for premium feel (snappy but smooth) */
  spring: "300ms cubic-bezier(0.175, 0.885, 0.32, 1.275)",

  /* Smooth scroll/fade */
  smooth: "400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
};

export const breakpoints = {
  xs: "320px",
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
};

/**
 * Component Presets — reusable style combinations (premium)
 */
export const components = {
  button: {
    base: "inline-flex items-center justify-center font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg",
    variants: {
      primary: "bg-primary-600 text-white hover:bg-primary-700 hover:shadow-lg focus:ring-2 focus:ring-primary-600 active:scale-0.95",
      secondary: "bg-neutral-100 text-black-matte hover:bg-neutral-200 hover:shadow-sm focus:ring-2 focus:ring-primary-600 active:scale-0.95",
      ghost: "text-primary-600 hover:bg-primary-50 focus:ring-2 focus:ring-primary-600 active:scale-0.95",
    },
    sizes: {
      sm: "h-9 px-3 text-sm",
      md: "h-10 px-4 text-base",
      lg: "h-12 px-6 text-lg",
    },
  },
  card: {
    base: "rounded-2xl bg-white shadow-card overflow-hidden",
    interactive: "rounded-2xl bg-white shadow-card overflow-hidden hover:shadow-lg transition-all duration-300",
    premium: "rounded-2xl bg-white shadow-card overflow-hidden hover:shadow-lg transition-all duration-300",
  },
  input: {
    base: "rounded-lg border border-neutral-200 bg-white px-4 py-3 text-base text-black-matte transition-all focus:border-transparent focus:ring-2 focus:ring-primary-600",
    label: "block text-sm font-semibold text-neutral-700 mb-2",
    helper: "text-xs text-neutral-500 mt-1",
    error: "border-red-500 ring-1 ring-red-200 text-red-600",
    success: "border-green-500 ring-1 ring-green-200 text-green-600",
  },
};
