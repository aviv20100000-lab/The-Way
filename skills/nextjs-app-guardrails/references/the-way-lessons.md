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
- Old and new route families both exist under `src/app/api/`: `quotes` and `motivation/quotes`, `steps` and `health/steps`, `meals` and `foods/meals`, `analyze-food` and `foods/analyze`.
- `next.config.ts` currently suppresses build and lint failures, which hides migration damage instead of forcing cleanup.

## 2. Testing Lag

### What happened
- The audit identified missing tests as a top release risk.
- Some hook tests were added, but coverage still does not clearly protect the highest-risk flows such as auth, route migration, and full feature behavior.

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
- `src/lib/auth.ts` moved session lifetime from 365 days to 7 days.
- `SECURITY_FIXES.md` documents remaining manual work such as rotating production secrets.

## 4. Build Hygiene

### What happened
- `next.config.ts` allows TypeScript and ESLint build failures to pass.
- This speeds short-term progress but makes the real status of the app harder to trust.

### What to do next time
- Treat ignored build failures as a temporary exception with an owner and a removal step.
- Before release work, remove the suppression or at least enumerate the exact unresolved errors.

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
