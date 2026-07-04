# Implementation Prompts

Use these compact patterns to keep plans and build steps consistent.

## Product Framing

Return:
- target users
- MVP modules
- must-have screens
- first vertical slice
- deferred modules
- privacy or permission concerns

## Suggested Build Plan Shape

1. Roles and auth
2. Domain map
3. Canonical route families
4. Must-have screens
5. First end-to-end slice
6. Minimal verification
7. Deferred features

## Recommended Domain Language

Prefer:
- `clients`
- `programs`
- `check-ins`
- `progress`
- `messages`

Avoid vague labels unless the user already has a stable convention:
- `manager`
- `updates`
- `system`
- `tools`
- `misc`

## Example Handoff Format

### Good
- Product: coach-client fitness app with workout assignment and weekly progress reviews
- MVP: dashboard, client list, workout plans, weekly check-ins, feedback
- Screens: login, coach dashboard, client detail, assigned plan, weekly check-in, coach review
- First slice: coach assigns plan, client views it, client submits check-in, coach responds

### Weak
- Product: full fitness platform with chat, AI, nutrition, workouts, billing, challenges, rewards, and analytics from day one

## Keep It Lean

If the plan starts sounding like a full platform, reduce it back to:
- one plan flow
- one progress flow
- one feedback loop

## Privacy Reminder

Whenever the scope includes body photos, measurements, or private health-like notes, explicitly mention:
- access control
- retention expectations
- coach versus client visibility
