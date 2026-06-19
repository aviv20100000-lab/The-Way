import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import webpush from "web-push";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!.replace(/^﻿/, ""),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  await ensureSeed();
  const session = await getSessionUser();
  if (!session || session.role !== "coach") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { title, body, userId } = await req.json();
  if (!title || !body) return NextResponse.json({ error: "חסרים פרטים" }, { status: 400 });

  // Get subscriptions — either specific user or all clients
  let subs;
  if (userId) {
    subs = (await db.execute({ sql: "SELECT * FROM push_subscriptions WHERE user_id=?", args: [userId] })).rows;
  } else {
    subs = (await db.execute({
      sql: "SELECT ps.* FROM push_subscriptions ps JOIN users u ON u.id=ps.user_id WHERE u.coach_id=?",
      args: [session.id],
    })).rows;
  }

  const payload = Buffer.from(JSON.stringify({ title, body, icon: "/icon-192.png" }), "utf8");
  let sent = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
        payload,
        { contentEncoding: "aes128gcm" }
      );
      sent++;
    } catch {
      // Remove expired subscription
      await db.execute({ sql: "DELETE FROM push_subscriptions WHERE endpoint=?", args: [sub.endpoint as string] });
    }
  }

  return NextResponse.json({ sent });
}
