import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import db, { initDb } from "@/lib/db";

/**
 * Self-service escape hatch for the login rate limiter. Session-based admin auth
 * (getSessionUser) is useless here — the whole point is the coach is locked OUT
 * of login — so this is gated by CRON_SECRET instead, the same secret already
 * configured in Vercel for cron endpoints. Visit as a bookmarked link; do not
 * share the URL, it doubles as a login-lock bypass.
 */
function timingSafeCompare(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  const provided = req.nextUrl.searchParams.get("secret") ?? "";
  if (!timingSafeCompare(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await initDb();
  const res = await db.execute({ sql: "DELETE FROM rate_limits WHERE key LIKE 'login:%'" });

  return NextResponse.json({ ok: true, cleared: res.rowsAffected });
}
