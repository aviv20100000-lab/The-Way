---
name: nextjs-app-guardrails
description: Prevent repeated architecture, product-structure, testing, and security mistakes while building or refactoring a Next.js application. Use when planning a new app, especially a coach-client fitness app, adding a major feature, reorganizing routes, extracting hooks/components, touching auth or middleware, preparing a deployment, or when the codebase is drifting into duplicate endpoints, oversized page files, disabled build checks, weak role boundaries, or missing verification.
---

# Nextjs App Guardrails

Review the request against the guardrails below before writing code. Optimize for catching the mistakes early, not documenting them after they ship.

Read [references/the-way-lessons.md](references/the-way-lessons.md) when the task involves architecture, auth, testing, API route changes, or deployment readiness. That file contains the concrete mistakes and recoveries extracted from this app.

Read [references/nextjs-build-order.md](references/nextjs-build-order.md) when the user is starting a new app or wants the fastest safe implementation order.

If the request is specifically about a coach-client fitness product, pair this skill with `$fitness-coach-app-builder` for product shape, MVP scoping, and domain defaults.

When the app is for fitness coaching, wellness tracking, or a coach-client workflow, also treat the product defaults in this file as part of the guardrails. Keep the user's concept, but reduce reinvention around roles, modules, and safe MVP scope.

## Product Defaults For Coach Apps

Use these defaults unless the user clearly wants a different business model:

### App Type
- Multi-client coaching app where one coach or a small team manages many clients.
- Mobile-first experience for clients, with simple day-to-day logging and check-ins.
- Dashboard-style experience for coaches, with fast visibility across clients.

### Core Roles
- Coach: manages clients, plans, messaging, and progress review.
- Client: views plans, logs activity, uploads updates, and communicates with the coach.
- Admin: optional; use only if there is a real operational need beyond coach permissions.

### Core Modules
- Client management
- Workout plans
- Nutrition or meal logging
- Progress tracking such as weight, measurements, steps, water, or check-ins
- Progress photos
- Messaging or comments
- Reminders and nudges

### MVP Priority
Build these first unless the user explicitly wants a different order:

1. Auth and role setup
2. Coach dashboard with client list
3. Client profile and goals
4. One plan flow such as workouts or nutrition
5. One progress flow such as weekly check-in or weight tracking
6. Basic coach-client messaging or feedback loop

### Data Model Defaults
Start from a simple domain map and only expand when the user needs more:
- Coach
- Client
- Program
- WorkoutPlan
- MealLog
- CheckIn
- ProgressMetric
- ProgressPhoto
- Message
- Reminder

### Fitness-Specific Safety
- Treat body photos, weight, measurements, and health-like notes as sensitive data.
- Keep coach-to-client permissions explicit; never assume one client can view another client's data.
- Avoid medical claims, diagnosis language, or treatment-style flows unless the user explicitly wants a regulated experience.
- If a feature looks health-sensitive, surface privacy, consent, and data-retention implications early.

## Workflow

1. Classify the task.
- New feature: check route naming, component boundaries, fetch patterns, and tests before coding.
- Refactor: check for temporary dual structures, stale imports, and partial migrations before moving files.
- Auth/security: check cookie settings, CSRF coverage, rate limiting, secret handling, and build/runtime compatibility.
- Release: check that build and lint failures are not being silenced and that critical flows are verified.
- New coach app: confirm roles, core modules, canonical route families, and MVP boundaries before adding polish features.

2. Scan for known regression signals.
- Page files above roughly 300 lines, especially if they combine data loading, mutations, and presentation.
- Duplicate or overlapping API endpoints that serve the same domain through multiple paths.
- Old and new route families living together during a migration.
- Direct `fetch(...)` scattered through UI instead of a shared API helper.
- `ignoreBuildErrors` or `ignoreDuringBuilds` enabled without a short-term containment plan.
- Security controls added in one place but not consistently enforced across state-changing routes.
- Tests existing only for utilities while critical user flows remain unverified.
- Coach and client actions sharing endpoints without clear permission checks.
- Feature sprawl before the first end-to-end coach-client flow is actually stable.

3. Apply the smallest stabilizing move first.
- Extract logic into hooks before redesigning UI.
- Consolidate endpoint names before adding more route variants.
- Add a central API helper before spreading more request code.
- Add a smoke test around the risky flow before deep refactors.
- Fix build blockers instead of suppressing them unless the user explicitly accepts the risk.
- Reduce MVP scope before inventing more modules.

4. Finish the loop.
- Run the smallest meaningful verification for the changed area.
- Record any intentional temporary risk in the code or final handoff.
- If a migration remains half-complete, say so explicitly and name the remaining cleanup.
- If the app is for coaching, state which coach flow and which client flow are already real versus still planned.

## Build Order

When building a similar app from scratch, prefer this order unless the user has a strong reason to invert it:

1. Define the domain map.
- Pages, user roles, core flows, and one canonical API path per domain.
- Decide route names before creating duplicate "temporary" endpoints.
- For coach apps, decide which modules belong in MVP and which are intentionally deferred.

2. Build the shared spine.
- Auth/session utilities.
- Shared API client for fetch, CSRF, and common errors.
- Core types, constants, and validation helpers.
- Role-aware access rules for coach versus client.

3. Build the thinnest vertical slice.
- One real user flow end to end.
- One page, one route family, one persistence path, one verification step.
- Prefer one coach action plus one client response to prove the model.

4. Extract only after the second repetition.
- Shared hooks after similar logic appears twice.
- Shared components after the same UI pattern appears twice.
- Avoid speculative abstractions.

5. Expand by domain, not by scattered screens.
- Finish `foods` before touching three unrelated features.
- Finish `health` before adding more route aliases.

6. Stabilize before polish.
- Route cleanup, build cleanup, and tests come before animation, dark mode, or extra dashboards.

## Guardrails

## Architecture
- Keep page files focused on composition and interaction wiring. Move repeated data logic into hooks and shared helpers.
- Use one canonical API path per domain concept. If a better path is introduced, migrate callers and remove the old one in the same stream of work when feasible.
- Centralize constants such as endpoints, limits, and defaults.
- Prefer feature folders that reflect user intent over historical implementation names.
- If two route files contain substantially the same logic, stop and consolidate before adding a third caller.
- If a page still performs direct `fetch(...)` calls after a shared API helper exists, treat that as drift and either migrate or justify it.
- In coach apps, organize by domain such as `clients`, `programs`, `check-ins`, `messages`, and `progress`, not by vague UI labels.
- Keep coach tools and client tools separate in routing and permissions even when they share lower-level helpers.

## Testing
- Treat "no tests yet" as active risk, especially before refactors.
- Add at least one verification layer near the changed behavior: route test, hook test, or manual smoke checklist.
- When moving routes or auth flows, verify both success and failure states.
- Do not mistake lightweight hook existence tests for coverage of the real user flow.
- For coach-client products, verify at least one permission boundary and one real logging flow before calling the feature stable.

## Security
- Never rely on UI-only checks for protected actions.
- Ensure CSRF coverage matches every state-changing route family you add.
- Rate limit auth and other abuse-prone endpoints.
- Keep secrets out of source control and call out any rotation or deployment action that code alone cannot finish.
- Be careful with middleware/runtime boundaries. Edge middleware cannot safely import every server utility.
- Treat progress photos, measurements, and private messages as sensitive by default.
- Verify that one client cannot enumerate or infer another client's records.

## Release Readiness
- Do not normalize `ignoreBuildErrors` or ignored lint failures into the default workflow.
- Before calling something ready, check build, the core user path, and the changed admin/coach path if one exists.
- Treat duplicated structures, hidden build failures, and missing tests as reasons to label the result "working but not stabilized."
- For coach apps, do not call it MVP-complete if the coach can create data but the client cannot reliably see or respond to it.

## Decision Rules

- If the codebase already contains old and new versions of the same route family, prefer cleanup over adding features.
- If the app has build suppression enabled, avoid large refactors until the current hidden failures are understood.
- If auth, coach/admin capabilities, and client capabilities share utilities, verify both permission directions before closing the task.
- If a request seems "small" but touches route naming, auth, or middleware, slow down and review the reference files first.
- If the user asks for many modules at once, default to one clean vertical slice and name the deferred modules explicitly.
- If a fitness feature can be implemented as notes plus progress tracking before adding automation or AI, prefer the simpler version first.

## Output Style
- Give the user a short risk map first: what is okay, what is drifting, what is likely to slow the next build.
- Turn repeated pain into a checklist or a concrete refactor order, not a vague recommendation.
- When relevant, separate "fix now" from "can wait" so momentum stays high.
- For new coach apps, include: roles, MVP modules, canonical route families, first vertical slice, and any privacy-sensitive data decisions.
