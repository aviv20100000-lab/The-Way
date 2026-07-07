# Deployment Guide

THE WAY is deployed to **Vercel** with a **Turso (libSQL)** database.

## Environment Variables

Create `.env.local` with:

```
# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Database (Turso)
TURSO_URL=libsql://...
TURSO_TOKEN=...

# Auth
JWT_SECRET=<random 32+ chars>       # required — session signing, throws on startup if missing
CRON_SECRET=<random string>         # required — Bearer token that protects /api/cron/* routes

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:...

# Optional
NEXT_PUBLIC_API_URL=https://the-way-app-two.vercel.app
```

## Local Development

```bash
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000)

## Production Deploy

**Normal flow: commit → `git push` to `main`.** GitHub is connected to the Vercel
project `the-way-app`; every push to `main` triggers an automatic production
deployment to `https://the-way-app-two.vercel.app`. Do not run a manual `vercel deploy`
unless you have a specific reason to bypass the normal flow — `git push` alone is
enough, and a stray manual deploy can create a confusing second deployment.

```bash
git add <files>
git commit -m "..."
git push
```

## Database Migrations

Turso uses **libSQL** (SQLite-compatible).

To run migrations:
```bash
# This happens automatically on app startup via initDb()
# See: src/lib/db.ts
```

Schema is defined in `initDb()` function.

## Build Output

```bash
npm run build
```

Creates optimized build in `.next/`

## Verification

### After Deploy

1. **Check health:** `https://the-way-app-two.vercel.app/api/auth/me`
   - Should redirect to `/login` (expected)

2. **Test login:** demo credentials only exist in local dev (`npm run db:seed`,
   guarded by `NODE_ENV !== "production"` in `src/lib/seed.ts`). They are never
   created in production — log in with a real coach/client account there.

3. **Test features:**
   - [ ] Upload meal photo (Food tab)
   - [ ] Log weight (Weight tab)
   - [ ] Upload steps screenshot (Steps tab)
   - [ ] Add water (Home tab)
   - [ ] Push notifications (if PWA)

## Rollback

If something breaks:

```bash
# Revert to previous deploy
vercel rollback
```

## Monitoring

- **Logs:** View in Vercel dashboard → Deployments → Function Logs
- **Database:** Access via Turso Studio (https://studio.turso.tech)
- **Performance:** Check Core Web Vitals in Vercel Analytics

## Cron Jobs

Water reminder runs daily via:
- **Primary:** `/api/cron/water-reminder` in `vercel.json`
- **Backup:** cron-job.org (3-hour intervals)

Check logs:
```bash
vercel logs --follow
```

## Secrets Management

Never commit `.env.local`!

Add secrets in Vercel dashboard:
1. Project Settings → Environment Variables
2. Add ANTHROPIC_API_KEY, TURSO_URL, TURSO_TOKEN, etc.
3. Redeploy

## Troubleshooting

### Build fails
```bash
# Check build locally first
npm run build

# If succeeds locally but fails on Vercel, check:
# - Node version (18+)
# - Dependencies installed
# - Environment variables set
```

### Database connection fails
```bash
# Check Turso credentials
vercel env ls

# Verify token has read/write access
# Re-generate token if needed
```

### Cron job not running
- Check cron schedule in `vercel.json`
- Verify Vercel Hobby plan (limited to 1 daily cron job)
- Check logs: `vercel logs`

## Costs

- **Vercel:** ~$10-20/month (Hobby plan + Pro if needed)
- **Turso:** Free tier (or $29+/month for Pro)
- **Claude API:** Pay-as-you-go (~$0.10-0.50/month for light usage)

## Future Improvements

- [ ] Add staging environment
- [ ] Implement database backups
- [ ] Set up error tracking (Sentry)
- [ ] Add performance monitoring (PostHog)

---

Questions? Check [CONTRIBUTING.md](../CONTRIBUTING.md) or [API.md](./API.md)
