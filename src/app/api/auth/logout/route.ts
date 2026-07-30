import { NextRequest, NextResponse } from "next/server";
import { clearSession, getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

/**
 * Logging out also releases this device's push subscription for this account.
 *
 * A phone can hold the subscriptions of several accounts at once, so the row is
 * matched on user AND endpoint: other accounts signed in on the same device keep
 * theirs, and this account's other devices keep theirs too. Without this, someone
 * who signed in once on a borrowed phone would keep receiving their coach's
 * messages there forever.
 *
 * The browser-side subscription itself is deliberately left in place — it belongs
 * to the device, and the next account to sign in reuses it.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();

  if (user) {
    const body = await req.json().catch(() => null);
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
    if (endpoint) {
      try {
        await db.execute({
          sql: "DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
          args: [user.id, endpoint],
        });
      } catch (error) {
        // Never block a logout on this. Worst case the row lingers and is cleaned
        // up the next time a send to it fails.
        console.error("[logout] failed to release push subscription", error);
      }
    }
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}
