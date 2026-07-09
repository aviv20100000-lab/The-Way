# Codex Project Memory

## Deployment

- On 2026-07-04 the repository was synchronized with production in commit `115f2f9` and pushed to `main`.
- GitHub `main` is connected to the active Vercel project `the-way-app`.
- After changes are committed, running `git push` triggers an automatic production deployment to `https://the-way-app-two.vercel.app`.
- `git push` does not deploy uncommitted local edits. The normal flow is: edit, verify, commit, push.
- Do not run a separate manual Vercel deployment unless it is explicitly required.
- The stale duplicate Vercel project `project-dxx1s` was permanently removed on 2026-07-05. The only active project is `the-way-app`.
- The nightly database-backup workflow is active. Its first manual run succeeded and created a compressed GitHub Actions artifact.

## Assistant Bot Notes

- The trainee shopping/nutrition bot is intentionally separate from the coach-facing menu-building assistant.
- On 2026-07-09, the trainee bot was upgraded by adding `src/lib/assistant-brain.ts` as a dedicated "brain" layer with response playbooks for morning, lunch, evening, night, hunger, supermarket questions, unknown products, and off-plan days.
- Existing coach methodology and nutrition rules in `src/lib/assistant.ts` were not removed. The new brain layer is added on top of the existing prompt, and the final answer goes through a polish step to make Hebrew shorter, cleaner, phone-readable, and less Markdown-like.
- Keep the bot tone natural Israeli Hebrew: practical coach on WhatsApp, not formal, not childish, not disrespectful.
- Avoid breaking the `search_food` tool and Tzameret flow. The bot must not invent nutrition values; if exact data is missing, it should ask for the product label or give a cautious rule of thumb.
