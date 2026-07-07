import db, { initDb } from "./db";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const DAY_MS = 24 * 60 * 60 * 1000;

const LIMITS = {
  auth: { requests: 5, windowMs: 15 * 60 * 1000 }, // 5 requests per 15 minutes
  api: { requests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
  admin: { requests: 10, windowMs: 60 * 1000 }, // 10 requests per minute
  assistant: { requests: 30, windowMs: DAY_MS }, // 30 bot messages per day
  mealScan: { requests: 3, windowMs: DAY_MS }, // 3 AI meal photo scans per day
  stepsScan: { requests: 2, windowMs: DAY_MS }, // 2 AI steps screenshots per day
  menuSuggest: { requests: 40, windowMs: DAY_MS }, // 40 AI menu-building suggestions per day, per coach
  menuImport: { requests: 15, windowMs: DAY_MS }, // 15 free-text menu imports per day, per coach
  lowBalanceAlert: { requests: 1, windowMs: 6 * 60 * 60 * 1000 }, // 1 Telegram alert per 6 hours
};

export type RateLimitType = keyof typeof LIMITS;

export function checkRateLimit(
  key: string,
  type: RateLimitType = "api"
): { allowed: boolean; remaining: number; resetIn: number } {
  const limit = LIMITS[type];
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + limit.windowMs,
    });
    return {
      allowed: true,
      remaining: limit.requests - 1,
      resetIn: limit.windowMs,
    };
  }

  if (entry.count >= limit.requests) {
    const resetIn = entry.resetTime - now;
    return {
      allowed: false,
      remaining: 0,
      resetIn,
    };
  }

  entry.count++;
  const remaining = limit.requests - entry.count;
  const resetIn = entry.resetTime - now;

  return {
    allowed: true,
    remaining,
    resetIn,
  };
}

// Friendly Hebrew "try again in..." phrase, scaling the unit to the wait length.
export function formatResetIn(resetInMs: number): string {
  const minutes = Math.max(1, Math.ceil(resetInMs / 60000));
  if (minutes < 60) return `${minutes} דקות`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? "שעה" : `${hours} שעות`;
}

export function clearRateLimitEntry(key: string) {
  rateLimitStore.delete(key);
}

export async function checkPersistentRateLimit(
  key: string,
  type: RateLimitType = "api"
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const limit = LIMITS[type];
  const now = Date.now();

  await initDb();

  const existing = await db.execute({
    sql: "SELECT count, reset_at FROM rate_limits WHERE key = ?",
    args: [key],
  });

  const row = existing.rows[0] as { count?: number; reset_at?: number } | undefined;

  if (!row || typeof row.reset_at !== "number" || now > row.reset_at) {
    const resetAt = now + limit.windowMs;
    await db.execute({
      sql: `
        INSERT INTO rate_limits (key, count, reset_at)
        VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at
      `,
      args: [key, resetAt],
    });
    return {
      allowed: true,
      remaining: limit.requests - 1,
      resetIn: limit.windowMs,
    };
  }

  const currentCount = typeof row.count === "number" ? row.count : 0;
  const resetIn = row.reset_at - now;

  if (currentCount >= limit.requests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn,
    };
  }

  const nextCount = currentCount + 1;
  await db.execute({
    sql: "UPDATE rate_limits SET count = ? WHERE key = ?",
    args: [nextCount, key],
  });

  return {
    allowed: true,
    remaining: limit.requests - nextCount,
    resetIn,
  };
}

// Clean up old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000);
