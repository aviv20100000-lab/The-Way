# 📂 Folder Organization Guide — THE WAY

**Where every file should go**

---

## Overview Map

```
src/
├─ app/                        [Next.js App Router]
│  ├─ api/                     [API Routes]
│  ├─ client/                  [Client Page]
│  ├─ coach/                   [Coach Page]
│  ├─ login/                   [Login Page]
│  ├─ layout.tsx               [Root Layout]
│  ├─ page.tsx                 [Landing]
│  ├─ globals.css              [Global Styles]
│  └─ pwa-register.tsx         [PWA Setup]
│
├─ components/                 [Reusable React Components]
│  ├─ MealHistory.tsx          [Shared meal history view]
│  ├─ ProgressRing.tsx         [Animated progress circle]
│  ├─ LoadingStates.tsx        [Loading states]
│  ├─ ui.tsx                   [NutritionBadge, MealCard, Header]
│  ├─ ErrorBoundary.tsx        [NEW: Error boundary wrapper]
│  └─ Loading/                 [NEW: Skeleton screens]
│     ├─ MealSkeleton.tsx
│     ├─ CardSkeleton.tsx
│     └─ StepsSkeleton.tsx
│
├─ hooks/                      [NEW: Custom React Hooks]
│  ├─ useAuth.ts              [Auth state + logout]
│  ├─ useFetch.ts             [Centralized fetch]
│  ├─ useNotifications.ts     [PWA push notifications]
│  ├─ client/                 [Client-specific hooks]
│  │  ├─ useClientHome.ts     [Quote, water, steps]
│  │  ├─ useFoodTracking.ts   [Upload, analyze, save]
│  │  ├─ useWeightTracking.ts [Logs, target, input]
│  │  └─ useStepsTracking.ts  [Leaderboard, upload]
│  └─ coach/                  [Coach-specific hooks]
│     ├─ useCoachClients.ts   [Clients list, add]
│     ├─ useFoodLogs.ts       [Food logs view]
│     ├─ useQuotes.ts         [Add/delete quotes]
│     └─ useLeaderboard.ts    [Steps leaderboard]
│
├─ lib/                        [Core Business Logic]
│  ├─ anthropic.ts            [Claude Vision API]
│  ├─ auth.ts                 [JWT + bcrypt]
│  ├─ claude.ts               [Claude API helpers]
│  ├─ db.ts                   [Turso/SQLite connection]
│  ├─ meals.ts                [Meal CRUD utilities]
│  ├─ types.ts                [TypeScript interfaces]
│  ├─ validation.ts           [Input validation]
│  ├─ design-system.ts        [Design tokens]
│  ├─ seed.ts                 [Database seeding]
│  ├─ api.ts                  [NEW: Fetch wrapper]
│  ├─ constants.ts            [NEW: Magic values]
│  └─ formatters.ts           [NEW: Date/time formatting]
│
├─ __tests__/                 [NEW: Test Suite]
│  ├─ api/
│  │  ├─ analyze-food.test.ts
│  │  ├─ weight.test.ts
│  │  ├─ quotes.test.ts
│  │  ├─ water.test.ts
│  │  ├─ steps.test.ts
│  │  └─ auth.test.ts
│  ├─ hooks/
│  │  ├─ useFetch.test.ts
│  │  ├─ useAuth.test.ts
│  │  ├─ client/
│  │  │  ├─ useClientHome.test.ts
│  │  │  └─ useFoodTracking.test.ts
│  │  └─ coach/
│  │     ├─ useCoachClients.test.ts
│  │     └─ useFoodLogs.test.ts
│  └─ components/
│     ├─ ProgressRing.test.tsx
│     ├─ MealHistory.test.tsx
│     └─ NutritionBadge.test.tsx
│
└─ public/                     [Static Assets]
   ├─ manifest.json           [PWA manifest]
   ├─ icon-192.png
   ├─ icon-512.png
   └─ icons/
```

---

## API Routes Organization

### Current (Before)
```
api/
├─ analyze-food/route.ts           ← confused with ai/analyze-meal
├─ ai/analyze-meal/route.ts        ← duplicate?
├─ food-logs/route.ts              ← unclear purpose
├─ log-meal/route.ts               ← another meal endpoint?
├─ auth/
│  ├─ login/route.ts
│  ├─ logout/route.ts
│  └─ me/route.ts
├─ meals/route.ts                  ← yet another meals endpoint
├─ weight/route.ts
├─ water/route.ts
├─ steps/route.ts
├─ quotes/route.ts
├─ leaderboard/route.ts
├─ clients/route.ts
├─ goals/route.ts
├─ share-food/route.ts
├─ foods/route.ts
├─ cron/water-reminder/route.ts
├─ admin/seed-quotes/route.ts
├─ push/
│  ├─ send/route.ts
│  └─ subscribe/route.ts
└─ client-summary/route.ts
```

### Recommended (After)
```
api/
├─ auth/                          [Authentication]
│  ├─ login/route.ts
│  ├─ logout/route.ts
│  └─ me/route.ts
│
├─ foods/                         [Food Tracking]
│  ├─ analyze/route.ts            [← was analyze-food]
│  ├─ meals/route.ts              [← was meals & log-meal]
│  ├─ history/route.ts            [← was food-logs]
│  └─ route.ts                    [← DELETE ai/analyze-meal]
│
├─ users/                         [User Management]
│  ├─ profile/route.ts            [← new: user info]
│  ├─ clients/route.ts            [← was clients]
│  ├─ goals/route.ts              [← was goals]
│  └─ weight/route.ts             [← was weight]
│
├─ health/                        [Health Metrics]
│  ├─ steps/route.ts              [← was steps]
│  ├─ water/route.ts              [← was water]
│  ├─ leaderboard/route.ts        [← was leaderboard]
│  └─ summary/route.ts            [← was client-summary]
│
├─ motivation/                    [Motivational Content]
│  ├─ quotes/route.ts             [← was quotes]
│  └─ notifications/route.ts      [← was push/send]
│
├─ push/                          [Push Notifications]
│  └─ subscribe/route.ts          [← was push/subscribe]
│
├─ cron/                          [Scheduled Tasks]
│  └─ water-reminder/route.ts
│
└─ admin/                         [Admin Functions]
   └─ seed-quotes/route.ts
```

### Migration Checklist
- [ ] Create new folder structure
- [ ] Copy files to new locations
- [ ] Delete old locations
- [ ] Update all fetch URLs in components
- [ ] Update all fetch URLs in hooks
- [ ] Update all test import paths
- [ ] Run `npm run build` (no errors)
- [ ] Run `npm run test` (all pass)

---

## Components Organization

### Current (Good)
```
components/
├─ MealHistory.tsx              ✅ Shared between client & coach
├─ ProgressRing.tsx             ✅ Animated progress circle
├─ LoadingStates.tsx            ✅ Loading state components
└─ ui.tsx                       ✅ NutritionBadge, MealCard, Header
```

### Recommended (Expand)
```
components/
├─ MealHistory.tsx              ✅ KEEP
├─ ProgressRing.tsx             ✅ KEEP
├─ LoadingStates.tsx            ✅ KEEP
├─ ui.tsx                       ✅ KEEP
│
├─ ErrorBoundary.tsx            ← NEW: Error handling wrapper
│
├─ Loading/                     ← NEW: Skeleton screens folder
│  ├─ MealSkeleton.tsx
│  ├─ CardSkeleton.tsx
│  ├─ HeaderSkeleton.tsx
│  └─ index.ts                  [Export all skeletons]
│
└─ Shared/                      ← NEW: Shared UI patterns (optional)
   ├─ Header.tsx
   ├─ BottomNav.tsx
   └─ index.ts
```

### When to Create New Component
✅ **Create new file when:**
- Used in 2+ pages
- Complex logic (100+ lines)
- Has own internal state
- Reusable pattern

❌ **Don't create when:**
- Only used once
- Simple JSX (< 30 lines)
- Specific to one page

---

## Hooks Organization

### Naming Convention
```
use[Feature][Action].ts
├─ useAuth.ts                     (no prefix)
├─ useFetch.ts                    (generic utilities)
├─ useNotifications.ts
├─ client/
│  ├─ useClientHome.ts            (feature: home)
│  ├─ useFoodTracking.ts          (feature: food)
│  ├─ useWeightTracking.ts        (feature: weight)
│  └─ useStepsTracking.ts         (feature: steps)
└─ coach/
   ├─ useCoachClients.ts          (feature: clients)
   ├─ useFoodLogs.ts              (feature: food logs)
   ├─ useQuotes.ts                (feature: quotes)
   └─ useLeaderboard.ts           (feature: leaderboard)
```

### What Goes in Each Hook

**useAuth.ts**
```typescript
// Returns
{
  user: User | null,
  isLoading: boolean,
  logout: () => Promise<void>,
}
```

**useFetch.ts**
```typescript
// Generic data fetching
{
  data: T | null,
  loading: boolean,
  error: string | null,
}
```

**client/useClientHome.ts**
```typescript
// Returns quote, water, steps (home tab data)
{
  quote: string,
  waterTotal: number,
  waterGoal: number,
  todaySteps: number,
  notifStatus: "unknown" | "granted" | "denied",
  loadHome: () => Promise<void>,
}
```

**client/useFoodTracking.ts**
```typescript
// Returns food tracking state
{
  analyzing: boolean,
  aiResult: AiResult | null,
  itemGrams: number[],
  myMeals: MyMeal[],
  todayCalories: number,
  handleUpload: (file: File) => Promise<void>,
  handleSave: () => Promise<void>,
}
```

### Hook File Template
```typescript
// src/hooks/client/use[Feature].ts
import { useState, useCallback, useEffect } from 'react';

interface State {
  // Define all state
}

export function use[Feature](): State {
  const [state, setState] = useState<State>({});
  
  const load = useCallback(async () => {
    // Fetch logic
  }, []);
  
  useEffect(() => {
    load();
  }, [load]);
  
  return {
    // Return state + handlers
  };
}
```

---

## Lib Organization

### What Goes Where

**api.ts** (NEW)
```typescript
// Centralized fetch wrapper
export async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T>
```

**constants.ts** (NEW)
```typescript
export const API_ENDPOINTS = { ... }
export const DEFAULTS = { ... }
export const LIMITS = { ... }
```

**formatters.ts** (NEW)
```typescript
export function formatDate(isoString): string
export function formatCalories(cal): string
export function formatTime(ms): string
```

**types.ts** (EXISTING)
```typescript
export interface User { ... }
export interface Food { ... }
export interface Meal { ... }
// All TypeScript types
```

**db.ts** (EXISTING)
```typescript
// Database connection & initialization
export async function initDb()
```

**auth.ts** (EXISTING)
```typescript
// JWT + bcrypt utilities
export function createToken(user)
export function verifyToken(token)
export function hashPassword(password)
```

**anthropic.ts** (EXISTING)
```typescript
// Claude Vision API calls
export async function analyzeFoodPhoto(base64)
export async function extractStepsFromScreenshot(base64)
```

**design-system.ts** (EXISTING)
```typescript
// Design tokens
export const colors = { ... }
export const typography = { ... }
export const spacing = { ... }
export const shadows = { ... }
```

---

## Test File Organization

### Naming Convention
```
[source-file].test.ts
├─ api/
│  └─ foods/
│     └─ analyze.test.ts        ← matches src/app/api/foods/analyze/route.ts
├─ hooks/
│  ├─ useFetch.test.ts
│  └─ client/
│     └─ useClientHome.test.ts  ← matches src/hooks/client/useClientHome.ts
└─ components/
   └─ ProgressRing.test.tsx     ← matches src/components/ProgressRing.tsx
```

### Test File Template
```typescript
import { describe, it, expect } from '@jest/globals';

describe('[Feature]', () => {
  it('should [expected behavior]', async () => {
    // Setup
    // Action
    // Assert
  });
});
```

---

## Public Assets Organization

```
public/
├─ manifest.json               [PWA manifest]
├─ icon-192.png               [App icon 192x192]
├─ icon-512.png               [App icon 512x512]
├─ apple-touch-icon.png       [iOS icon]
├─ favicon.ico                [Browser tab icon]
└─ images/                    [Optional: shared images]
   ├─ hero-bg.jpg
   └─ logo.svg
```

---

## Environment Variables File

**`.env.local`** (in root)
```
# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Database
TURSO_URL=libsql://...
TURSO_TOKEN=...

# Push Notifications
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Optional
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## Root Configuration Files

```
/
├─ package.json               [Dependencies & scripts]
├─ tsconfig.json             [TypeScript config]
├─ next.config.ts            [Next.js config]
├─ postcss.config.mjs        [Tailwind config]
├─ jest.config.js            [Jest config]
├─ jest.setup.js             [Jest setup]
├─ .env.local                [Environment variables]
├─ .gitignore                [Git ignore rules]
├─ .git/                     [Git history]
├─ vercel.json               [Vercel deployment config]
├─ manifest.json             [PWA manifest]
├─ README.md                 [Project overview]
├─ AUDIT_COMPREHENSIVE.md    [Full audit report]
├─ IMPLEMENTATION_CHECKLIST.md [Action plan]
├─ FOLDER_ORGANIZATION_GUIDE.md [This file]
└─ data/                     [Local SQLite database]
   └─ nutrition.db
```

---

## Quick Reference: File Purposes

| File | Purpose | When to Edit |
|------|---------|--------------|
| `components/*.tsx` | Reusable UI | Adding shared visual patterns |
| `hooks/client/*.ts` | Client page logic | Client features |
| `hooks/coach/*.ts` | Coach page logic | Coach features |
| `lib/*.ts` | Core utilities | Business logic |
| `app/api/*/route.ts` | API endpoints | Backend endpoints |
| `__tests__/*.test.ts` | Tests | Before refactoring |
| `.env.local` | Secrets | Deployment |
| `package.json` | Dependencies | Adding packages |

---

## Summary: Do's & Don'ts

### ✅ DO
- Keep related files close (hooks in hooks/, API in api/)
- Use clear naming (useClientHome.ts, not use1.ts)
- Create folders when multiple files of same type
- Keep lib/ for shared logic
- Keep components/ for reusable UI

### ❌ DON'T
- Create nested API folders beyond 3 levels (api/foods/meals/special/route.ts ← too deep)
- Mix business logic and UI in pages
- Keep large files (>300 lines) without splitting
- Create "utils" folders at multiple levels
- Put page-specific hooks in global hooks folder

---

## Migration Checklist

If you're reorganizing from old structure:

- [ ] Create new folder structure
- [ ] Move files to new locations
- [ ] Update all imports (search & replace)
- [ ] Update API URLs in hooks & components
- [ ] Run `npm run build` → no errors
- [ ] Run `npm run test` → all pass
- [ ] Test app manually → no broken features
- [ ] Delete old directories

---

**Reference:** [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)
