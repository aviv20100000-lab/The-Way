# THE WAY Lessons

Use this reference when the task touches the same classes of problems that appeared in this app.

## 1. Architecture Drift

### What happened
- `src/app/client/page.tsx` and `src/app/coach/page.tsx` grew into large mixed-concern files.
- The project began migrating from flat API routes to domain folders, but old and new endpoints coexisted.
- Request logic existed both in shared helpers and direct `fetch(...)` calls inside pages.

### What to do next time
- Split logic into hooks as soon as a page starts managing multiple data sources or mutation flows.
- Define the target route map before moving files.
- During migration, maintain a checklist of old path to new path and close entries only after callers are updated.
- Prefer one shared API helper for auth, CSRF, and common error handling.

### Real examples from this app
- Historical: old and new route families briefly coexisted (`quotes` vs `motivation/quotes`,
  `steps` vs `health/steps`, `analyze-food` vs `foods/analyze`). Verified 2026-07-07: the
  migration is complete — the old flat routes no longer exist, only the domain-folder
  versions (`foods/`, `health/`, `users/`, `motivation/`) remain. `meals/quick` is a
  distinct quick-add feature, not a leftover duplicate of `foods/meals`.
- Historical: `next.config.ts` suppressed build and lint failures. Fixed as of 2026-07-07
  (see section 4) — no longer suppressed.

## 2. Testing Lag

### What happened
- The audit identified missing tests as a top release risk.
- Fixed as of 2026-07-07: `src/__tests__/security/` now covers the highest-risk flows
  directly — route auth rejection (`route-auth.test.ts`), CSRF middleware
  (`middleware-csrf.test.ts`), password-reset token replay/integration, image validation,
  and audit logging. Hook and API tests cover the feature layer on top of that.

### What to do next time
- Before a refactor, add at least one test or smoke checklist around the behavior being moved.
- For route reorganization, verify old callers are removed and new paths are exercised.
- Prefer a small test that guards the contract over postponing testing for a "later phase."

## 3. Security Hardening After the Fact

### What happened
- Several important protections were added only after audit: stronger password rules, shorter JWT lifetime, CSRF validation, rate limiting, password reset, and middleware headers.
- Some remaining work still requires operational follow-through, not just code changes.

### What to do next time
- Add auth, CSRF, and rate-limit expectations at feature design time.
- For any new POST, PUT, PATCH, or DELETE route, verify how CSRF headers get attached and how failures return.
- Separate "code fixed" from "deployment still required," especially for secret rotation.

### Real examples from this app
- `src/middleware.ts` performs inline CSRF validation because middleware runs on Edge and cannot safely import the server-side CSRF module.
- `src/lib/auth.ts` session lifetime history: 365 days → cut to 7 days as a security
  hardening step → deliberately reverted to an effectively unbounded (10-year) lifetime
  on 2026-07-07 by product decision (users should stay logged in until they log out).
  This is a real product/security tradeoff, not an oversight — the actual revocation
  mechanism is `session_version` (bumped on password reset), which works regardless of
  token expiry. Don't "fix" this back to a short expiry without checking with the user
  first; it was requested explicitly.
- Verified 2026-07-07: no `.env*` file has ever been committed across the app's full git history (206 commits, checked with `git log --all`, not just recent history) — so key rotation is precautionary hygiene, not a response to an actual leak.

## 4. Build Hygiene

### What happened
- Earlier versions of `next.config.ts` allowed TypeScript and ESLint build failures to pass
  (`ignoreBuildErrors` / `ignoreDuringBuilds`). This speed short-term progress but made the
  real status of the app harder to trust.
- Fixed as of 2026-07-07: `next.config.ts` no longer sets either flag. `npx tsc --noEmit`
  runs clean.

### What to do next time
- Treat ignored build failures as a temporary exception with an owner and a removal step.
- Before release work, remove the suppression or at least enumerate the exact unresolved errors.
- Don't reintroduce these flags to silence a build error under deadline pressure — fix the
  actual error instead.

## 5. Practical Preflight Checklist

Run this checklist before major feature work or refactors:

1. Is there already another route, helper, or component doing almost the same job?
2. Will this change make a page file noticeably larger or introduce another inline fetch/mutation cluster?
3. Is there one canonical endpoint name for this feature?
4. Do state-changing requests inherit CSRF and error handling automatically?
5. Is there at least one verification step for the changed behavior?
6. Are build and lint failures visible, or are they being suppressed?
7. Is there any deployment action that code alone will not complete?

## 6. Recommended Refactor Order for Similar Apps

1. Consolidate route names and endpoint ownership.
2. Introduce or finish a shared API client.
3. Extract page logic into feature hooks.
4. Add tests around auth, route contracts, and highest-risk user flows.
5. Re-enable stricter build enforcement.
6. Only then expand the feature set again.

## 7. How To Reuse These Lessons For Coach Apps

Use these lessons as constraints, not as a copy-paste product plan.

### Keep from this app
- The focus on one canonical route family per domain
- Early auth and CSRF thinking
- Extracting hooks before page files become too heavy
- Treating hidden build failures as real risk

### Adapt for fitness coaching products
- Start with coach and client roles, not with every possible health metric
- Pick one progress loop first, such as weekly check-in, weight tracking, or workout completion
- Keep private body data and photos behind explicit ownership checks
- Prefer a simple coach dashboard over many disconnected features

### Do not repeat these mistakes in a new coach app
- Do not create separate route families for the same concept just because UI ideas changed
- Do not mix coach-only operations and client self-service operations without clear boundaries
- Do not build chat, meal analysis, workout tracking, and water tracking all at once before one full loop is stable
- Do not call the app production-ready while build errors are hidden and core permission paths are lightly checked
