import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import webpush from "web-push";

export const dynamic = "force-dynamic";

// POST /api/push/test — sends a test push to the current logged-in user only.
// Coach-only to prevent abuse.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (user.role !== "coach") return NextResponse.json({ error: "קואץ' בלבד" }, { status: 403 });

  try {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL!.replace(/^﻿/, ""),
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
  } catch {
    return NextResponse.json({ error: "VAPID לא מוגדר" }, { status: 500 });
  }

  await initDb();

  const subsRes = await db.execute({
    sql: `SELECT * FROM push_subscriptions WHERE user_id = ?`,
    args: [user.id],
  });

  if (subsRes.rows.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "אין subscription — הפעל התראות בדף הבית תחילה",
    });
  }

  const payload = JSON.stringify({
    title: "✅ בדיקת התראות",
    body: "ההתראות עובדות! 🎉",
    icon: "/icon-192.png",
  });

  let sent = 0;
  let failed = 0;
  for (const sub of subsRes.rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint as string,
          keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
        },
        payload
      );
      sent++;
    } catch {
      failed++;
      await db.execute({
        sql: "DELETE FROM push_subscriptions WHERE endpoint = ?",
        args: [sub.endpoint as string],
      });
    }
  }

  return NextResponse.json({
    ok: sent > 0,
    sent,
    failed,
    total: subsRes.rows.length,
    message: sent > 0 ? "התראת בדיקה נשלחה!" : "כל ה-subscriptions נכשלו ונמחקו",
  });
}
