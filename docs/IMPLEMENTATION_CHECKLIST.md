# 🎯 Implementation Checklist — THE WAY App
**Priority Order | Realistic Timeline**

---

## Phase 1: Extract Hooks (Est. 3-4 Days)
Reduce component bloat, enable testing

### Step 1.1: Create Core Hooks
- [ ] `src/hooks/useFetch.ts` — Centralized fetch wrapper with error handling
- [ ] `src/hooks/useAuth.ts` — Auth state (user, role, logout)
- [ ] `src/hooks/useNotifications.ts` — PWA notification logic

**Why first:** These are dependencies for other hooks

**Example:**
```typescript
// src/hooks/useFetch.ts
export function useFetch<T>(url: string, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetch(url).then(r => r.json()).then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, deps);
  
  return { data, loading, error };
}
```

### Step 1.2: Extract Client Page Hooks
- [ ] `src/hooks/client/useClientHome.ts` — Home tab (quote, water, steps)
- [ ] `src/hooks/client/useFoodTracking.ts` — Food tab (upload, analyze, save)
- [ ] `src/hooks/client/useWeightTracking.ts` — Weight tab (logs, target)
- [ ] `src/hooks/client/useStepsTracking.ts` — Steps tab (leaderboard, upload)

**Copy this:** Take states & useEffect from `client/page.tsx` → one hook each

### Step 1.3: Extract Coach Page Hooks
- [ ] `src/hooks/coach/useCoachClients.ts`
- [ ] `src/hooks/coach/useFoodLogs.ts`
- [ ] `src/hooks/coach/useQuotes.ts`
- [ ] `src/hooks/coach/useLeaderboard.ts`

### Step 1.4: Reduce Page Components
- [ ] Refactor `src/app/client/page.tsx` (800 → 200 lines)
- [ ] Refactor `src/app/coach/page.tsx` (600 → 150 lines)

**Before:**
```tsx
const [quote, setQuote] = useState("");
const [waterTotal, setWaterTotal] = useState(0);
// ... 30 more states
useEffect(() => { ... }, []);
return <div>800 lines of JSX</div>;
```

**After:**
```tsx
const { quote, waterTotal } = useClientHome();
const { analyzing, aiResult } = useFoodTracking();
return <ClientPageLayout />;
```

### Testing Phase 1
- [ ] `npm run dev` → test client page (should look identical)
- [ ] `npm run dev` → test coach page (should look identical)
- [ ] No new bugs ✅

---

## Phase 2: Add Tests (Est. 3-4 Days)
Catch regressions before deploying

### Step 2.1: Setup Testing Framework
- [ ] Install Jest: `npm install --save-dev jest @types/jest`
- [ ] Install React Testing: `npm install --save-dev @testing-library/react @testing-library/jest-dom`
- [ ] Create `jest.config.js`:
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
```
- [ ] Create `jest.setup.js`:
```javascript
import '@testing-library/jest-dom';
```
- [ ] Add `"test": "jest"` to package.json scripts

### Step 2.2: API Route Tests (8-10 tests)
- [ ] `src/__tests__/api/quotes.test.ts` — GET (single/list), POST, DELETE
- [ ] `src/__tests__/api/water.test.ts` — GET, POST
- [ ] `src/__tests__/api/weight.test.ts` — GET, POST
- [ ] `src/__tests__/api/meals.test.ts` — GET by date, POST
- [ ] `src/__tests__/api/auth.test.ts` — Login, logout, me

**Example:**
```typescript
// src/__tests__/api/quotes.test.ts
describe('GET /api/quotes', () => {
  it('should return single quote when no action param', async () => {
    const res = await fetch('/api/quotes');
    const data = await res.json();
    expect(data.text).toBeDefined();
  });
  
  it('should return array when action=list', async () => {
    const res = await fetch('/api/quotes?action=list');
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
```

### Step 2.3: Hook Tests (5 tests)
- [ ] `src/__tests__/hooks/useFetch.test.ts`
- [ ] `src/__tests__/hooks/useAuth.test.ts`
- [ ] `src/__tests__/hooks/client/useClientHome.test.ts`

### Step 2.4: Component Tests (3 tests)
- [ ] `src/__tests__/components/ProgressRing.test.tsx`
- [ ] `src/__tests__/components/MealHistory.test.tsx`
- [ ] `src/__tests__/components/NutritionBadge.test.tsx`

### Testing Phase 2
- [ ] `npm run test` → all pass ✅
- [ ] Coverage report: `npm run test -- --coverage`
- [ ] Goal: >70% coverage minimum

---

## Phase 3: Reorganize API Routes (Est. 1-2 Days)
Clear structure, remove confusion

### Step 3.1: Create New Folders
```
src/app/api/
├─ foods/
├─ users/
├─ health/
└─ motivation/
```

- [ ] `mkdir src/app/api/foods`
- [ ] `mkdir src/app/api/users`
- [ ] `mkdir src/app/api/health`
- [ ] `mkdir src/app/api/motivation`

### Step 3.2: Move Routes
- [ ] Move `analyze-food` → `foods/analyze/route.ts`
- [ ] Remove `ai/analyze-meal` (duplicate)
- [ ] Move `meals` → `foods/meals/route.ts`
- [ ] Move `food-logs` → `foods/history/route.ts`
- [ ] Move `weight` → `users/weight/route.ts`
- [ ] Move `goals` → `users/goals/route.ts`
- [ ] Move `steps` → `health/steps/route.ts`
- [ ] Move `water` → `health/water/route.ts`
- [ ] Move `leaderboard` → `health/leaderboard/route.ts`
- [ ] Move `quotes` → `motivation/quotes/route.ts`
- [ ] Move `clients` → `users/clients/route.ts`

### Step 3.3: Update Imports
- [ ] Search all `.tsx` files for old endpoints
- [ ] Replace `/api/analyze-food` with `/api/foods/analyze`
- [ ] Replace `/api/food-logs` with `/api/foods/history`
- [ ] Replace `/api/weight` with `/api/users/weight`
- [ ] Replace `/api/steps` with `/api/health/steps`
- [ ] Replace `/api/quotes` with `/api/motivation/quotes`
- [ ] Replace `/api/water` with `/api/health/water`
- [ ] Replace `/api/leaderboard` with `/api/health/leaderboard`
- [ ] Replace `/api/clients` with `/api/users/clients`
- [ ] Replace `/api/goals` with `/api/users/goals`

### Step 3.4: Update Constants (NEW FILE)
Create `src/lib/constants.ts`:
```typescript
export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: "/api/auth/login",
  AUTH_LOGOUT: "/api/auth/logout",
  AUTH_ME: "/api/auth/me",
  
  // Foods
  FOOD_ANALYZE: "/api/foods/analyze",
  FOOD_MEALS: "/api/foods/meals",
  FOOD_HISTORY: "/api/foods/history",
  
  // Users
  USER_PROFILE: "/api/users/profile",
  USER_GOALS: "/api/users/goals",
  USER_WEIGHT: "/api/users/weight",
  USER_CLIENTS: "/api/users/clients",
  
  // Health
  HEALTH_STEPS: "/api/health/steps",
  HEALTH_WATER: "/api/health/water",
  HEALTH_LEADERBOARD: "/api/health/leaderboard",
  
  // Motivation
  MOTIVATION_QUOTES: "/api/motivation/quotes",
  
  // Cron
  CRON_WATER_REMINDER: "/api/cron/water-reminder",
} as const;

export const DEFAULTS = {
  WATER_GOAL: 2000,
  CALORIE_GOAL: 2000,
  SYNC_INTERVAL: 5 * 60 * 1000,
} as const;
```

### Testing Phase 3
- [ ] `npm run dev` → Navigate all tabs (should work with new endpoints)
- [ ] No 404 errors ✅
- [ ] `npm run test` → All API tests pass with new paths ✅

---

## Phase 4: Add Utilities & Polish (Est. 2 Days)

### Step 4.1: Create API Wrapper
File: `src/lib/api.ts`
```typescript
export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(endpoint, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  
  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = "/login";
    }
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `API error: ${res.status}`);
  }
  
  return res.json();
}
```

### Step 4.2: Create Formatters
File: `src/lib/formatters.ts`
```typescript
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("he-IL");
}

export function formatCalories(cal: number): string {
  return `${Math.round(cal)} קלוריות`;
}

export function formatWater(ml: number): string {
  return `${Math.round(ml / 250)} כוסות`;
}
```

### Step 4.3: Create Error Boundary
File: `src/components/ErrorBoundary.tsx`
```typescript
import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-rose-50 text-rose-800 rounded">
          <p>משהו הלך לא בסדר. בדוק את הקונסול.</p>
          <button onClick={() => this.setState({ hasError: false })}>
            נסה שוב
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

### Step 4.4: Create Loading Skeletons
File: `src/components/Loading/MealSkeleton.tsx`
```typescript
export function MealSkeleton() {
  return (
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ repeat: Infinity, duration: 1.5 }}
      className="h-24 bg-gray-200 rounded-lg"
    />
  );
}
```

### Step 4.5: Wrap App with Error Boundary
Update `src/app/layout.tsx`:
```tsx
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <ErrorBoundary>
          <PwaRegister />
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

---

## Phase 5: Documentation (Est. 1 Day)

### Step 5.1: Create API Documentation
File: `API.md`
```markdown
# API Reference

## Endpoints

### GET /api/motivation/quotes
Returns a random quote for motivation.
- Params: none
- Response: { text, author }

### GET /api/motivation/quotes?action=list
Returns all quotes.
- Params: action=list
- Response: [{ id, text, author }, ...]

### POST /api/foods/meals
Create a new meal (with photo analysis).
- Body: { photo_base64, meal_type, notes }
- Response: { id, items, total_calories }
```

### Step 5.2: Create CONTRIBUTING.md
```markdown
# Contributing to THE WAY

## Setup
```bash
bun install
bun run dev
```

## Adding a Feature
1. Create a hook in `src/hooks/`
2. Write tests in `src/__tests__/`
3. Add component/page
4. Update this guide

## Testing
```bash
npm run test
npm run test -- --coverage
```

## API Routes
All endpoints are in `src/app/api/`. Follow the folder structure:
- `foods/` — Food tracking
- `users/` — User data
- `health/` — Health metrics
- `motivation/` — Motivational content
```

### Step 5.3: Create DEPLOYMENT.md
```markdown
# Deployment Guide

## To Vercel

```bash
export VERCEL_TOKEN="<your-token>"
vercel deploy --prod --yes --token "$VERCEL_TOKEN"
```

## Environment Variables
- ANTHROPIC_API_KEY
- TURSO_URL
- TURSO_TOKEN
- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
```

---

## Final Verification

### Run This Checklist Before Deploying
- [ ] `npm run build` → No errors
- [ ] `npm run test` → All tests pass (>70% coverage)
- [ ] `npm run dev` → All tabs work
- [ ] Navigation: home → food → weight → steps → back (no errors)
- [ ] Upload photo (food tab)
- [ ] Add water (home tab)
- [ ] Coach: view clients, add quote, leaderboard
- [ ] Mobile: test on actual device if possible
- [ ] No console errors (F12 → Console tab)

---

## Timeline Summary

| Phase | Task | Days | Total |
|-------|------|------|-------|
| 1 | Extract Hooks | 3-4 | 3-4 |
| 2 | Add Tests | 3-4 | 6-8 |
| 3 | Reorganize API | 1-2 | 7-10 |
| 4 | Utilities + Polish | 2 | 9-12 |
| 5 | Documentation | 1 | 10-13 |
| — | Testing/Fixes | 2-3 | 12-16 |

**Total: 2-3 weeks of focused work**

---

## What NOT to Do
- ❌ Don't refactor CSS/design (it's perfect)
- ❌ Don't reorganize `src/lib/` (already good)
- ❌ Don't change database schema (normalized & clean)
- ❌ Don't add new features yet (stabilize first)

---

## Need Help?
Refer to:
- [Full Audit](AUDIT_COMPREHENSIVE.md)
- [Project Context](./memory/the-way-project-context.md)
- [API Mapping](./memory/api-endpoints-mapping.md)

---

**Generated:** 2026-06-20 | **Status:** Ready to implement
