import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const sub = await req.json();
  const { endpoint, keys } = sub;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "נתוני subscription לא תקינים" }, { status: 400 });
  }

  await db.execute({
    sql: `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
          VALUES (?,?,?,?,?)
          ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth`,
    args: [uuid(), session.id, endpoint, keys.p256dh, keys.auth],
  });

  return NextResponse.json({ ok: true });
}
