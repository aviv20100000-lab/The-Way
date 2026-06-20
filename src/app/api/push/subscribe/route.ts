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

  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    return NextResponse.json({ error: "endpoint לא תקין" }, { status: 400 });
  }

  if (endpoint.length > 2048) {
    return NextResponse.json({ error: "endpoint ארוך מדי" }, { status: 400 });
  }

  if (typeof keys.p256dh !== "string" || keys.p256dh.length < 20 || keys.p256dh.length > 500) {
    return NextResponse.json({ error: "p256dh לא תקין" }, { status: 400 });
  }

  if (typeof keys.auth !== "string" || keys.auth.length < 16 || keys.auth.length > 500) {
    return NextResponse.json({ error: "auth לא תקין" }, { status: 400 });
  }

  await db.execute({
    sql: `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
          VALUES (?,?,?,?,?)
          ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth`,
    args: [uuid(), session.id, endpoint, keys.p256dh, keys.auth],
  });

  return NextResponse.json({ ok: true });
}
