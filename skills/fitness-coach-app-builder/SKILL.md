---
name: fitness-coach-app-builder
description: Plan and build coach-client fitness applications with a practical MVP, clear roles, domain-first structure, and safe delivery order. Use when the user wants a fitness coach app, trainer dashboard, client progress app, workout or nutrition tracking product, or asks to build a wellness coaching system from scratch or extend one without losing focus.
---

# Fitness Coach App Builder

## Overview

Turn a broad "build me a fitness app" request into a clean product plan and implementation path.
Default to a coach-client product with strong role separation, one coherent MVP, and a build order that avoids feature sprawl.

Read [references/coach-app-blueprint.md](references/coach-app-blueprint.md) when you need the default product structure, roles, modules, and data model.

Read [references/mvp-slices.md](references/mvp-slices.md) when the user asks to move fast, build an MVP, or you need to choose the first vertical slice.

Read [references/implementation-prompts.md](references/implementation-prompts.md) when you need default wording for plans, assumptions, route families, or handoff structure.

If the product is being built in Next.js, also use `$nextjs-app-guardrails` to keep architecture, auth, testing, and release risks under control.

## Workflow

1. Frame the product before coding.
- Identify the business model: solo coach, coaching team, studio, or premium online program.
- Confirm the main roles: usually coach and client; add admin only if operationally necessary.
- Choose the first core loop: assign plan, log progress, review progress, respond.

2. Reduce the request to one MVP.
- Keep only the smallest set that proves the product works.
- Prefer one plan domain plus one progress domain plus one communication loop.
- Defer AI, payments, community, challenges, and advanced automations unless the user explicitly prioritizes them.

3. Organize by domain, not by screens.
- Use route families and folders such as `clients`, `programs`, `check-ins`, `progress`, `messages`, and `nutrition`.
- Keep coach actions and client actions clearly separated even when they share lower-level helpers.

4. Ship one vertical slice first.
- Start with one coach action and one client response.
- Favor end-to-end usefulness over many partial modules.
- If the first slice feels awkward, simplify the model before adding more features.

5. Protect trust-sensitive data early.
- Treat progress photos, measurements, weight, nutrition notes, and private messages as sensitive.
- Enforce explicit ownership and permission checks.
- Avoid medical framing unless the user wants a regulated health product.

6. Close with a build-ready output.
- Return the MVP modules.
- Return the canonical route families.
- Return the first vertical slice.
- Return what is intentionally deferred.
- Return any privacy or permission risks that need attention.

## Product Defaults

Use these defaults unless the user clearly wants a different product shape:

### Roles
- Coach
- Client
- Admin only if needed

### Core Modules
- Client management
- Goals and onboarding
- Workout plans or nutrition plans
- Progress tracking
- Check-ins
- Messaging
- Reminders

### Strong MVP Default
- Coach dashboard
- Client list
- Client detail page
- One plan module
- One progress module
- One feedback loop

### Must-Have Screens
- Login
- Coach dashboard
- Client list
- Client detail
- Assigned plan view
- Progress or check-in submission
- Coach review or feedback view

### Common Progress Options
- Weekly check-in
- Weight tracking
- Measurements
- Workout completion
- Water or steps only as secondary add-ons

### Base Data Entities
- Coach
- Client
- Goal
- Program
- CheckIn
- ProgressMetric
- Message

## Common Business Shapes

- Personal coach: prioritize client list, assigned plans, weekly check-ins, and feedback.
- Studio or small team: keep the same base but add coach ownership and visibility rules.
- Nutrition-focused coach: make nutrition the first plan module and weekly review the first progress loop.

## Decision Rules

- If the user asks for many features at once, compress to one MVP and name the deferred set explicitly.
- If two modules can be represented as one simpler flow, prefer the simpler flow first.
- If a coach cannot easily review a client's latest update, the product loop is not complete yet.
- If the client cannot see what the coach assigned, the slice is not complete yet.
- If the app is mobile-heavy, optimize client flows for fast logging before adding heavy dashboards.
- If the feature touches personal body data, raise privacy and access-control checks before polish.

## Output Pattern

When relevant, structure the response in this order:

1. Product shape
- Who the users are
- What the MVP does
- What is deferred

2. Build structure
- Domains
- Route families
- Data entities
- Must-have screens
- First vertical slice

3. Risks
- Permission boundaries
- Sensitive data handling
- Anything likely to create rework later

## Example Triggers

- "Build me an app for fitness coaches"
- "Create a trainer dashboard with clients and progress photos"
- "I want a nutrition and workout tracking app for my coaching business"
- "Help me plan the MVP for a coach-client wellness app"
- "Add the right structure before we start coding this trainer app"
