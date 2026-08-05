import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { isExpiredPushSubscription, logPushFailure } from "@/lib/push-errors";
import webpush from "web-push";

export const dynamic = "force-dynamic";

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

function setupVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!.replace(/^﻿/, ""),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

async function sendToSubs(subs: Sub[], payload: string) {
  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (error) {
      failed++;
      if (isExpiredPushSubscription(error)) {
        // By id: another account on the same device has its own row here.
        await db.execute({ sql: "DELETE FROM push_subscriptions WHERE id = ?", args: [sub.id] });
      } else {
        logPushFailure("push test", error);
      }
    }
  }
  return { sent, failed };
}

// POST /api/push/test?type=test|morning — coach only
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (user.role !== "coach") return NextResponse.json({ error: "קואץ' בלבד" }, { status: 403 });

  try { setupVapid(); } catch {
    return NextResponse.json({ error: "VAPID לא מוגדר" }, { status: 500 });
  }

  await initDb();
  const type = new URL(req.url).searchParams.get("type") ?? "test";

  if (type === "morning") {
    const rows = (await db.execute({
      sql: `
        SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
        FROM push_subscriptions ps
        JOIN users u ON u.id = ps.user_id
        WHERE u.id = ? OR u.coach_id = ?
      `,
      args: [user.id, user.id],
    })).rows as unknown as Sub[];

    if (rows.length === 0) return NextResponse.json({ ok: false, error: "אין subscriptions בכלל" });

    const payload = JSON.stringify({ title: "🌅 בוקר טוב!", body: "בוקר טוב יא כאובים! 💪", icon: "/icon-192.png", url: "/" });
    const { sent, failed } = await sendToSubs(rows, payload);
    return NextResponse.json({ ok: sent > 0, sent, failed, total: rows.length, message: `נשלח ל-${sent} משתמשים` });
  }

  // Default: test push to self only
  const rows = (await db.execute({
    sql: "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
    args: [user.id],
  })).rows as unknown as Sub[];

  if (rows.length === 0) return NextResponse.json({ ok: false, error: "אין subscription — הפעל התראות בדף הבית תחילה" });

  const payload = JSON.stringify({ title: "✅ בדיקת התראות", body: "ההתראות עובדות! 🎉", icon: "/icon-192.png", url: "/coach" });
  const { sent, failed } = await sendToSubs(rows, payload);
  return NextResponse.json({ ok: sent > 0, sent, failed, total: rows.length, message: sent > 0 ? "התראת בדיקה נשלחה!" : "שליחת ההתראה נכשלה" });
}
