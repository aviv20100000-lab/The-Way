# Codex Project Memory

## Deployment

- On 2026-07-04 the repository was synchronized with production in commit `115f2f9` and pushed to `main`.
- GitHub `main` is connected to the active Vercel project `the-way-app`.
- After changes are committed, running `git push` triggers an automatic production deployment to `https://the-way-app-two.vercel.app`.
- `git push` does not deploy uncommitted local edits. The normal flow is: edit, verify, commit, push.
- Do not run a separate manual Vercel deployment unless it is explicitly required.
- The stale duplicate Vercel project `project-dxx1s` was permanently removed on 2026-07-05. The only active project is `the-way-app`.
- The nightly database-backup workflow is active. Its first manual run succeeded and created a compressed GitHub Actions artifact.
