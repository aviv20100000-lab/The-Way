# Claude Project Instructions

Use the local skills in this repository before planning or building major product work.

## Skill Routing

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

## Default Combined Behavior

For a new coach-client app in Next.js:
1. Read `fitness-coach-app-builder` first for product shape.
2. Read `nextjs-app-guardrails` second for implementation guardrails.
3. Return a concise plan with:
- roles
- MVP modules
- must-have screens
- route families
- first vertical slice
- deferred features
- privacy or permission risks

## Keep It Lean

Do not expand into a full platform too early.
Prefer:
- one plan flow
- one progress flow
- one feedback loop

Defer extras unless the user explicitly prioritizes them:
- AI features
- payments
- community
- challenges
- advanced analytics
