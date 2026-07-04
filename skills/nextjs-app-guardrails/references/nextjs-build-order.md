# Next.js Build Order

Use this reference when speed matters and the goal is to avoid a future cleanup tax.

## Core Principle

Build the app in layers that reduce future branching:
- first naming,
- then shared plumbing,
- then one real flow,
- then repetition-aware extraction,
- then expansion.

This is faster than jumping straight into many screens because it prevents duplicate routes, duplicate state logic, and hidden auth bugs.

## Recommended Order

### 1. Define the contract before coding
- User roles
- Main screens
- Domain folders
- Canonical API paths
- Minimal shared types
- For coach apps: decide the coach flow, the client flow, and the first weekly habit or progress loop.

Bad pattern:
- creating `/api/meals`, `/api/log-meal`, and `/api/foods/meals` in different moments without a chosen owner.

Good pattern:
- deciding once that meals belong to `foods/meals` and keeping aliases temporary and tracked.

Coach app example:
- deciding once that client progress belongs to `progress` and weekly reviews belong to `check-ins`, instead of mixing them across `dashboard`, `clients`, and `updates`.

### 2. Create the shared foundation
- `auth.ts`
- `api.ts`
- `validation.ts`
- `constants.ts`
- middleware/security boundary
- role and ownership checks for coach versus client data

Goal:
- every future route and page should inherit the same session, CSRF, and error behavior by default.

### 3. Ship one vertical slice
- one route family
- one page or one tab
- one save/read cycle
- one verification step

Example:
- login
- fetch current user
- create meal
- view meal history

Coach app example:
- coach creates a client plan
- client views the assigned plan
- client submits one check-in
- coach reviews that check-in

If this slice feels awkward, the architecture is warning you early.

### 4. Extract from repetition, not from prediction

Create a custom hook when:
- the same async state pattern appears in multiple places
- one page starts carrying too many independent fetch/mutation states
- the logic needs isolated testing

Create a shared component when:
- the same visual block is repeated
- a section becomes hard to reason about inside the page

Avoid:
- creating many empty abstractions before the second concrete use.

### 5. Expand one domain at a time

Finish a domain enough that it feels internally coherent:
- routes named consistently
- shared helpers used consistently
- main success/failure path verified

Then move to the next domain.

This is usually faster than touching food, weight, chat, push, and admin in parallel.

In coach apps, this is usually faster than touching workouts, meals, water, chat, payments, and progress photos all at once.

### 6. Clean while the context is fresh

Before starting another feature:
- remove old route aliases if migration is done
- move leftover direct fetches to the shared helper
- recheck any build suppression
- add or update the minimal verification

## Fast Preflight Before Any New Feature

1. Which domain owns this feature?
2. Which existing page/hook/route is closest to it?
3. Will this introduce another endpoint name for the same concept?
4. Will this push a page toward "god component" territory?
5. What is the one smallest verification we can add now?

### Coach App MVP Shortcut

If the user wants "an app for fitness coaches" and speed matters, default to:

1. Coach dashboard
2. Client list
3. Client detail page
4. One plan module
5. One progress module
6. One feedback loop

Only add extras such as AI analysis, challenges, community, or payments after this base is coherent.

## Speed Traps

- Hiding TypeScript or lint failures for too long
- Keeping old and new routes alive together
- Adding inline fetch logic in pages after shared helpers exist
- Expanding features faster than route cleanup
- Calling the app "done" when only the happy path was checked
- Adding too many fitness modules before the first coach-client loop works cleanly
