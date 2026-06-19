interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const LIMITS = {
  auth: { requests: 5, windowMs: 15 * 60 * 1000 }, // 5 requests per 15 minutes
  api: { requests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
  admin: { requests: 10, windowMs: 60 * 1000 }, // 10 requests per minute
};

export function checkRateLimit(
  key: string,
  type: "auth" | "api" | "admin" = "api"
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

export function clearRateLimitEntry(key: string) {
  rateLimitStore.delete(key);
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
