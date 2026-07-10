# Coach App Blueprint

## Default Product Shape

Use this as the default starting point for coach-client fitness apps unless the user clearly wants a different structure.

### Primary Users
- Coach
- Client
- Admin only if operations truly require it

### Core Promise
- The coach can assign, review, and respond.
- The client can view, log, and update.
- Both sides can complete one clear progress loop without confusion.

## Recommended Domains

- `clients`
- `programs`
- `workouts`
- `nutrition`
- `check-ins`
- `progress`
- `messages`
- `reminders`

Use only the domains needed for the MVP. Do not create empty domains in advance.

## Default Data Entities

- Coach
- Client
- Goal
- Program
- WorkoutPlan
- NutritionPlan
- CheckIn
- ProgressMetric
- ProgressPhoto
- Message
- Reminder

## Must-Have Screens

- Login
- Coach dashboard
- Client list
- Client detail
- Assigned plan screen
- Check-in or progress submission screen
- Coach review or feedback screen

Keep the first release focused on these screens before adding extras.

## Route Family Guidance

Choose one canonical family per concept.

Examples:
- `api/clients`
- `api/programs`
- `api/check-ins`
- `api/progress`
- `api/messages`

Avoid mixing the same concept across vague families such as `dashboard`, `updates`, `tools`, or `manager`.

## Permission Boundaries

- Coach can access assigned clients only.
- Client can access only personal records and assigned plans.
- Admin should not be added unless there is a real workflow that coach permissions cannot cover.
- Progress photos, measurements, and private notes require strict ownership checks.

## Good MVP Combinations

### Option A: Workout-first
- Client list
- Client profile
- Workout assignment
- Workout completion or weekly check-in
- Coach feedback

### Option B: Nutrition-first
- Client list
- Nutrition plan
- Meal logging
- Weekly review
- Coach comments

### Option C: Progress-first
- Client goals
- Weight or measurement tracking
- Weekly check-in
- Progress photos
- Coach review

## Business Variants

### Personal Trainer
- Focus on workout assignment, progress updates, and direct feedback.

### Studio Or Small Team
- Keep the same MVP shape, but add clear coach ownership over clients.

### Nutrition Coach
- Make nutrition plans and meal review the first plan-feedback loop.
