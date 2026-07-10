# Bugbot Plan

## Goal

Build a Telegram-connected safety bot that helps catch app problems early, without wasting AI tokens or taking risky actions automatically.

## Current Decision

Do not build the full auto-fixing bot yet.

The app currently has a small user base, so the best next step is a lean monitoring bot:

- Detect issues like a real user.
- Send clear Telegram alerts.
- Let Aviv trigger checks manually.
- Avoid automatic code fixes for now.

## Recommended Lean MVP

1. Keep the existing health check every 5 minutes.
2. Add real-user smoke tests that run without AI:
   - Login.
   - Client home loads.
   - Weight tab loads.
   - Menu tab loads.
   - Competition tab loads.
   - Chat page loads.
3. Add one optional AI chat smoke test per day at most:
   - Send a short message to the assistant.
   - Verify no generic failure message appears.
4. Add Telegram commands:
   - `/check` - run smoke test now.
   - `/status` - show last check result.
5. Weekly AI budget cap:
   - Maximum $1 per week.
   - At $0.80, ask for approval before any AI action.
   - At $1.00, stop AI actions until next week.

## Future Auto-Fix Bot

Only build this later if the app has more users or repeated bugs.

Rules for future auto-fix:

- Small safe fixes can be automatic.
- Risky fixes must ask for Telegram approval.
- No automatic action if tests fail.
- No uncontrolled token spending.
- One bug per branch and PR.
- Prefer GitHub Actions as the runner.

## Safe Auto-Fix Limits

An automatic fix is allowed only if all are true:

- Up to 7 minutes.
- Up to 2 files.
- One fix attempt.
- No database changes.
- No auth or permissions changes.
- No secrets or environment changes.
- No deletions.
- No large refactor.
- TypeScript and tests pass.

Anything outside those rules must ask Aviv on Telegram first.

## Important Data Rule

Existing users Aviv and Dani may be used for lightweight checks, but the bot must not delete, reset, or overwrite their data.

Prefer dedicated test users later.
