export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: "/api/auth/login",
  AUTH_LOGOUT: "/api/auth/logout",
  AUTH_ME: "/api/auth/me",

  // Foods
  FOOD_ANALYZE: "/api/foods/analyze",
  FOOD_MEALS: "/api/foods/meals",

  // Users
  USER_WEIGHT: "/api/users/weight",
  USER_GOALS: "/api/users/goals",
  USER_CLIENTS: "/api/users/clients",

  // Health
  HEALTH_WATER: "/api/health/water",
  HEALTH_STEPS: "/api/health/steps",
  HEALTH_LEADERBOARD: "/api/health/leaderboard",

  // Motivation
  MOTIVATION_QUOTES: "/api/motivation/quotes",

  // Push
  PUSH_SUBSCRIBE: "/api/push/subscribe",
  PUSH_SEND: "/api/push/send",
} as const;

export const DEFAULTS = {
  WATER_GOAL: 2000,
  CALORIE_GOAL: 2000,
  WEIGHT_MIN: 20,
  WEIGHT_MAX: 500,
  WATER_MIN: 1,
  WATER_MAX: 5000,
  IMAGE_QUALITY: 0.82,
  IMAGE_MAX_WIDTH: 1200,
} as const;

export const LABELS = {
  breakfast: "ארוחת בוקר",
  lunch: "ארוחת צהריים",
  dinner: "ארוחת ערב",
  snack: "חטיף",
} as const;
