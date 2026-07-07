# Project Structure — THE WAY

Last verified against the actual codebase: 2026-07-07. If anything here contradicts the
code you're reading, trust the code — this file can drift out of date over time.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Next.js 15 (App Router, Turbopack in dev) |
| Styling | Tailwind CSS 4, CSS variable tokens in `src/app/globals.css` |
| Backend | Next.js API routes (Node.js runtime, except `middleware.ts` which is Edge) |
| Database | Turso (LibSQL) — cloud-hosted SQLite, not local SQLite |
| AI | Anthropic Claude API — food photo analysis, steps-screenshot reading, AI assistant chat |
| Nutrition data | Tzameret (Israeli Ministry of Health official food DB), imported into Turso |
| Auth | JWT (`jose`) + bcrypt, double-submit-cookie CSRF |
| Notifications | Web Push (VAPID) |
| Package manager | npm (not Bun — `package-lock.json` is the source of truth) |
| Testing | Jest + Testing Library, 13 test files across `src/__tests__/{api,hooks,lib,security}` |

## Roles

Two roles only: `coach` and `client` (no `admin` role in this app). A client's
`users.coach_id` points to their coach; a coach's `coach_id` is NULL.

## Folder structure

```
src/
├─ app/
│  ├─ api/            # ~61 route.ts files, organized by domain (see below)
│  ├─ client/          # client dashboard
│  ├─ coach/           # coach dashboard
│  ├─ chat/            # chat UI
│  ├─ login/, forgot-password/, reset-password/, accessibility/
│  ├─ layout.tsx, layout-content.tsx, globals.css
│  └─ page.tsx         # landing / redirect
├─ components/         # ~28 reusable components (MealScanner, WeightJourney,
│                        MilestoneCelebration, ConnectSetup, coach/ subfolder, etc.)
├─ hooks/
│  ├─ useAuth.ts, useWaterTracker.ts
│  └─ client/          # useClientHome, useFoodTracking, useWeightTracking, useStepsTracking
├─ lib/                # ~30 files — see below
├─ middleware.ts        # Edge runtime: auth redirect, CSRF check, security headers
└─ __tests__/          # api/ hooks/ lib/ security/
```

## API route domains (`src/app/api/`)

`admin/`, `assistant/`, `auth/`, `chat/`, `client-errors/`, `client-summary/`, `coach/`,
`cron/`, `foods/`, `health/`, `home/`, `meals/`, `menus/`, `motivation/`, `push/`, `users/`

This is the result of a completed migration away from an earlier flat structure — there
are no leftover duplicate route families (verified 2026-07-07).

## Key files in `src/lib/`

| File | Purpose |
|---|---|
| `db.ts` | Turso connection + `initDb()` (creates all tables) |
| `auth.ts` | Session cookie, JWT sign/verify, `getSessionUser()`, session revocation via `session_version` |
| `csrf.ts` / `csrf-client.ts` | CSRF token generation (server) and attachment (client fetch calls) |
| `password-reset.ts` | One-time JWT reset tokens (15 min expiry, single-use via `jti`) |
| `ratelimit.ts` | In-memory limiter for short windows, DB-persisted limiter (`checkPersistentRateLimit`) for daily/hourly windows |
| `anthropic.ts` | Claude food-photo analysis, steps-screenshot reading |
| `assistant.ts` / `assistant-context.ts` | AI assistant chat, separate from food analysis |
| `tzameret.ts` | Search against the official nutrition DB |
| `chat-group.ts` / `chat-contacts.ts` / `chat-reactions.ts` / `chat-push.ts` | Chat authorization, reactions, push notifications |
| `security-alerts.ts` | Sends alerts (Telegram) on suspicious/blocked requests |
| `audit-log.ts` | Persists security-relevant events |
| `coach-insights.ts` / `daily-summary.ts` | Coach-facing analytics |
| `milestoneShareImage.ts` | Generates shareable milestone images (client-side canvas) |
| `blob-storage.ts` / `image-validation.ts` / `image-compression.ts` | File upload pipeline (Vercel Blob, magic-byte validation, client-side compression) |

## Database — key tables (see `src/lib/db.ts` for the authoritative schema)

- `users` — id, name, email, username, password_hash, role (`coach`\|`client`), coach_id, session_version, in_default_group
- `goals`, `meals`, `meal_items`, `foods` (small custom list)
- `tzameret_foods`, `tzameret_portions` — official nutrition DB, primary lookup
- `water_logs`, `water_streak`, `weight_logs`, `steps_logs`
- `chat_messages` (1:1 via `receiver_id` OR group via `group_id`, never both; `pinned` flag), `chat_groups`, `chat_group_members`, `chat_message_reactions`
- `push_subscriptions`, `password_reset_tokens`, `rate_limits`, `audit_log`, `quotes`

## Authentication & sessions

1. Login → bcrypt verify → JWT (HS256). As of 2026-07-07 the token/cookie lifetime is
   effectively unbounded (10-year expiry) by product decision — users stay logged in
   until they explicitly log out. The real revocation path is `session_version`
   (below), not expiry.
2. Session cookie `the-way-session`, httpOnly, secure in production.
3. `session_version` on the user row lets a password reset invalidate all other
   active sessions immediately.
4. CSRF: double-submit cookie, validated in `middleware.ts` for every state-changing
   `/api/*` request except `/api/cron/*` (those use a Bearer token instead).

## Environment variables

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full list — the two most commonly
mis-typed are `TURSO_URL` / `TURSO_TOKEN` (not `DATABASE_URL`).

## Scripts

```bash
npm run dev          # Turbopack dev server
npm run build        # Production build
npm run start         # Production server
npm run lint          # ESLint
npm test              # Jest
npm run test:coverage # Jest with coverage
npm run db:seed       # Seed dev DB (tsx src/lib/seed.ts) — no-ops when NODE_ENV=production
```

## Known non-issues (checked, not left as open questions)

- No `.env*` file has ever been committed, across the app's full git history (206
  commits, checked with `git log --all`). Key rotation is optional hygiene, not a
  response to an actual leak.
- `next.config.ts` does not suppress TypeScript or ESLint build errors.
- `npm audit` shows 2 moderate findings, both in a nested `postcss` dependency bundled
  inside Next.js itself — not exploitable in this app's runtime, and "fixing" it would
  force-downgrade Next to an old canary release.
