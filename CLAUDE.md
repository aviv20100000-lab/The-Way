# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## שפה

תמיד תענה למשתמש בעברית פשוטה וקצרה, גם אם השאלה נכתבה באנגלית.

## Project

The Way — a Hebrew (RTL) PWA for fitness coaches and their trainees. Trainees photograph
meals and upload step-count screenshots; Claude (Anthropic API) analyzes them and returns
nutrition values; coaches see everything in one dashboard (chat, group management,
weight/water/steps tracking, an AI assistant).

Stack: Next.js 15 (App Router, Turbopack) + React 19 + TypeScript (strict) · Turso (LibSQL,
cloud — not local SQLite) · JWT (jose) + bcrypt auth with CSRF double-submit cookies ·
Tzameret (Israeli Ministry of Health) official nutrition DB · Tailwind CSS + Framer Motion ·
Web Push (VAPID) + Vercel Cron.

## Commands

```bash
npm run dev              # dev server (Turbopack), also auto-seeds demo users (skipped when NODE_ENV=production)
npm run build             # production build — run before pushing
npm test                  # jest
npm test -- --testPathPattern="useAuth"   # run a single test file
npm run test:watch
npm run test:coverage
npm run lint
npm run db:seed           # manually seed demo data (src/lib/seed.ts)
```

## Skill Routing

Use the local skills in this repository before planning or building major product work.

### 1. Fitness coach app requests

If the user asks to build, plan, scope, restructure, or extend any of these:
- fitness coach app
- trainer dashboard
- coach-client wellness app
- workout tracking app
- nutrition coaching app
- client progress app

First read:
- `skills/fitness-coach-app-builder/SKILL.md`

Then read references from that skill as needed:
- `skills/fitness-coach-app-builder/references/coach-app-blueprint.md`
- `skills/fitness-coach-app-builder/references/mvp-slices.md`
- `skills/fitness-coach-app-builder/references/implementation-prompts.md`

Use that skill to:
- choose the MVP
- define roles
- define the core modules
- define must-have screens
- define the first vertical slice
- name deferred features explicitly

### 2. Next.js architecture and safety

If the task also involves Next.js implementation, refactoring, auth, routes, middleware, testing, or deployment readiness, also read:
- `skills/nextjs-app-guardrails/SKILL.md`

Then read references from that skill as needed:
- `skills/nextjs-app-guardrails/references/the-way-lessons.md`
- `skills/nextjs-app-guardrails/references/nextjs-build-order.md`

Use that skill to:
- avoid duplicate route families
- avoid oversized page files
- preserve auth and permission boundaries
- keep build and verification discipline

### Default Combined Behavior

For a new coach-client app in Next.js:
1. Read `fitness-coach-app-builder` first for product shape.
2. Read `nextjs-app-guardrails` second for implementation guardrails.
3. Return a concise plan with: roles, MVP modules, must-have screens, route families, first vertical slice, deferred features, privacy or permission risks.

### Keep It Lean

Do not expand into a full platform too early. Prefer one plan flow, one progress flow, one feedback loop.
Defer extras unless the user explicitly prioritizes them: AI features, payments, community, challenges, advanced analytics.

## Architecture

```
src/
├── app/
│  ├── api/          # API routes, organized by domain: auth/ chat/ coach/ foods/ health/ users/ meals/ menus/ motivation/ push/ cron/ admin/ ...
│  ├── client/        # Trainee dashboard
│  ├── coach/         # Coach dashboard
│  ├── chat/          # Shared chat UI
│  └── page.tsx       # Landing page
├── components/       # Reusable React components
├── hooks/
│  ├── useAuth.ts
│  ├── client/        # Trainee-specific hooks (useClientHome, useFoodTracking, ...)
│  └── coach/         # Coach-specific hooks
└── lib/
   ├── auth.ts         # Auth utilities (JWT session, bcrypt)
   ├── csrf.ts / csrf-client.ts  # CSRF double-submit cookie — csrf-client attaches the token to state-changing fetch() calls
   ├── db.ts            # Turso/LibSQL connection
   ├── anthropic.ts      # Claude API wrapper (food photo / steps screenshot analysis)
   ├── assistant.ts + assistant-brain.ts + assistant-context.ts  # trainee-facing AI assistant: assistant.ts holds coach methodology/nutrition rules, assistant-brain.ts is a playbook layer on top (morning/lunch/evening/night/hunger/supermarket/unknown-product/off-plan-day), keep both — don't collapse them
   ├── tzameret.ts       # Official nutrition DB lookups — never invent nutrition values
   └── types.ts
```

There is no `src/lib/api.ts` fetch wrapper or `src/hooks` barrel file — import each hook
directly from its own path. Design tokens live as CSS variables in `src/app/globals.css`
(`--color-*`), not in a separate `design-system.ts`.

API route convention (`src/app/api/**/route.ts`): check auth via `getSessionUser()` → `initDb()`
if needed → validate input → return JSON with proper status codes and Hebrew error messages.

Middleware (`src/middleware.ts`) exempts `public/` static assets from the auth redirect —
be careful not to break that when touching auth redirects.

Further docs: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) (env vars/deploy),
[docs/API.md](./docs/API.md) (endpoint reference), [docs/MONITORING.md](./docs/MONITORING.md)
(health-check bot), [docs/PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md).

## Deployment Memory

- GitHub `main` is connected to the active Vercel project `the-way-app`; every push to `main` triggers an automatic production deployment to `https://the-way-app-two.vercel.app`.
- Normal release flow: save changes, create a git commit, then run `git push`. Vercel deploys automatically; do not run a separate manual Vercel deployment unless explicitly needed.
- `git push` only sends committed changes. Local edits that were not committed are not deployed.
- The nightly database-backup GitHub Actions workflow is active.
- Only the USER pushes/deploys — give him the `git push` command to run himself; never run it (or `vercel deploy`) yourself.

## Hard Rules — learned from real mistakes (do NOT violate)

### Workflow

- NEVER use browser/preview tools (`preview_screenshot`, `preview_start`, `preview_eval`, `preview_snapshot`, etc.). Verify instead with: (a) `npx tsc --noEmit`, (b) re-read the final diff and trace the logic by hand for a concrete scenario, (c) tell the user exactly what to click and check in HIS browser.
- The user often works in a SECOND parallel AI session on this repo. NEVER `git add -A` or `git add .` — stage only files YOU touched this session. Run `git status` first and call out files you didn't touch. Re-read shared files (`src/middleware.ts`, `src/app/coach/page.tsx`, hooks) immediately before editing — they may have changed under you.
- Before writing any code, READ the actual current source files involved. The codebase changes fast (multiple features per session) — never code from memory of "how it probably looks."

### Debugging methodology (saves hours)

- When ONE feature/tab fails → read its `route.ts` API handler FIRST, not CSS or component code. Check request param names (e.g. the quotes DELETE endpoint wants `quoteId`, not `id`) and response shape (array vs object). Guessing at UI code once wasted 2 hours on a bug that was a mismatched param name.
- Phantom React render errors with NO error message, especially after big file changes: usually stale `.next` build artifacts, not real bugs. Stop the dev server, delete `.next`, restart, hard-refresh (Ctrl+Shift+R) BEFORE diving into code.
- Testing endpoints with Hebrew payloads: NEVER curl from Windows — Git Bash mangles Hebrew into `�` before the request leaves the machine. Write a small Node `.mjs` script using `fetch()` and run `node script.mjs`.

### Architecture gotchas

- `src/middleware.ts` runs in the EDGE runtime: no Node `crypto`, no `next/headers`. Never import from `@/lib/csrf` there — the CSRF double-submit check is inline pure-JS. Breaking this 500s EVERY authenticated POST in production (`MIDDLEWARE_INVOCATION_FAILED`).
- Every new client-side POST to `/api/*` MUST send the `x-csrf-token` header — use `getCsrfToken()` / `withCsrf()` from `src/lib/csrf-client.ts` — or it 403s.
- New static asset under `public/` referenced from a logged-out page (login etc.): verify its file extension is in the middleware exemption regex, or the request silently 307s to `/login`. Test in an incognito window, not your logged-in dev browser.

### AI / nutrition rules

- Food-scan API calls: NEVER combine `thinking` with forced tool use (`tool_choice`) — it breaks the call entirely. Never add food-name examples (חומוס, שקשוקה…) to the scan prompt — it causes hallucinated foods; visual cues only (color, texture, shape). Scan image compression stays at 1568px / quality 0.9 — do not lower it for speed.
- Any meat-detection logic (`isMeatDish` or any variant) MUST exclude fish from the start: guard with `&& !/דג|סלמון|טונה|בס|דניס|נסיכה|פילה/i.test(name)`. This bug was reintroduced once already; never again.
