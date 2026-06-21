import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import crypto from "crypto";
import { sendTelegramAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Env vars the app genuinely needs in production. A missing one here is a real,
// app-breaking misconfiguration worth alerting on.
const REQUIRED_ENV = [
  "TURSO_URL",
  "TURSO_TOKEN",
  "JWT_SECRET",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_EMAIL",
  "ANTHROPIC_API_KEY",
];

type Check = { name: string; ok: boolean; detail: string };

function timingSafeCompare(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function handle(req: NextRequest) {
  // Same auth pattern as the water-reminder cron: Vercel Cron sends
  // "Authorization: Bearer <CRON_SECRET>"; an external monitor can pass ?secret=.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const qs = req.nextUrl.searchParams.get("secret");
    const authValid = auth ? timingSafeCompare(auth, `Bearer ${secret}`) : false;
    const qsValid = qs ? timingSafeCompare(qs, secret) : false;
    if (!authValid && !qsValid) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const checks: Check[] = [];
  const origin = process.env.HEALTHCHECK_BASE_URL || req.nextUrl.origin;

  // 1) Required environment configuration ------------------------------------
  const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
  checks.push({
    name: "env",
    ok: missingEnv.length === 0,
    detail: missingEnv.length ? `missing: ${missingEnv.join(", ")}` : "all set",
  });

  // 2) Database reachability (read-only) -------------------------------------
  try {
    const r = await db.execute(
      "SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM push_subscriptions) AS subs"
    );
    const row = r.rows[0] as unknown as { users: number; subs: number };
    checks.push({ name: "db", ok: true, detail: `users=${row.users} subs=${row.subs}` });
  } catch (e) {
    checks.push({ name: "db", ok: false, detail: msg(e) });
  }

  // 3) CSRF token endpoint + middleware (the exact failure that broke pushes) -
  // We GET a token, then POST it (with no session) to a protected endpoint.
  // Expected: 401 (auth missing) — which proves the CSRF middleware PASSED.
  //   500 => middleware crashed (the Edge-runtime bug). 403 => CSRF chain broken.
  // No data is written: the route returns 401 before any DB mutation.
  try {
    const tokRes = await fetch(`${origin}/api/auth/csrf-token`, { cache: "no-store" });
    const token = (await tokRes.json().catch(() => ({}))).token as string | undefined;
    const cookie = (tokRes.headers.get("set-cookie") || "").split(";")[0];

    if (!tokRes.ok || !token) {
      checks.push({ name: "csrf-token", ok: false, detail: `status ${tokRes.status}` });
    } else {
      checks.push({ name: "csrf-token", ok: true, detail: "200 + token" });

      const postRes = await fetch(`${origin}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": token, cookie },
        body: JSON.stringify({ healthcheck: true }),
        cache: "no-store",
      });
      checks.push({
        name: "csrf-middleware",
        ok: postRes.status === 401,
        detail: `POST status ${postRes.status} (expect 401)`,
      });
    }
  } catch (e) {
    checks.push({ name: "http", ok: false, detail: msg(e) });
  }

  const allOk = checks.every((c) => c.ok);
  const newStatus = allOk ? "ok" : "fail";
  const now = new Date().toISOString();

  // Dedup: only alert on a state CHANGE (ok->fail or fail->ok), so a sustained
  // outage doesn't spam every run. If the DB is down we can't read prior state,
  // so we treat it as changed and alert (a DB outage is worth nagging about).
  let prevStatus: string | null = null;
  let changed = true;
  try {
    await db.execute(
      `CREATE TABLE IF NOT EXISTS system_health (
         id INTEGER PRIMARY KEY CHECK (id = 1),
         status TEXT NOT NULL,
         last_checked TEXT NOT NULL,
         last_changed TEXT NOT NULL
       )`
    );
    const prev = await db.execute("SELECT status FROM system_health WHERE id = 1");
    prevStatus = (prev.rows[0]?.status as string) ?? null;
    changed = prevStatus !== newStatus;
  } catch {
    // DB unreachable — keep changed = true so the failure still alerts.
  }

  if (changed) {
    const lines = checks
      .map((c) => `${c.ok ? "✅" : "❌"} <b>${c.name}</b>: ${c.detail}`)
      .join("\n");
    const header = allOk
      ? "✅ <b>THE WAY</b> — המערכת חזרה לתקינות"
      : "🚨 <b>THE WAY</b> — זוהתה תקלה בפרודקשן!";
    await sendTelegramAlert(`${header}\n\n${lines}\n\n🔗 ${origin}`);
  }

  // Persist current status (best-effort).
  try {
    await db.execute({
      sql: `INSERT INTO system_health (id, status, last_checked, last_changed)
            VALUES (1, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              status = excluded.status,
              last_checked = excluded.last_checked,
              last_changed = CASE WHEN system_health.status <> excluded.status
                                  THEN excluded.last_changed
                                  ELSE system_health.last_changed END`,
      args: [newStatus, now, now],
    });
  } catch {
    // ignore persistence failure
  }

  return NextResponse.json(
    { status: newStatus, checks, alerted: changed, checkedAt: now },
    { status: allOk ? 200 : 503 }
  );
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
