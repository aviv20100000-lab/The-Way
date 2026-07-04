import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import webpush from "web-push";

export const dynamic = "force-dynamic";

type Sub = { endpoint: string; p256dh: string; auth: string };

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
    } catch {
      failed++;
      await db.execute({ sql: "DELETE FROM push_subscriptions WHERE endpoint = ?", args: [sub.endpoint] });
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
        SELECT ps.endpoint, ps.p256dh, ps.auth
        FROM push_subscriptions ps
        JOIN users u ON u.id = ps.user_id
        WHERE u.id = ? OR u.coach_id = ?
      `,
      args: [user.id, user.id],
    })).rows as unknown as Sub[];

    if (rows.length === 0) return NextResponse.json({ ok: false, error: "אין subscriptions בכלל" });

    const payload = JSON.stringify({ title: "🌅 בוקר טוב!", body: "בוקר טוב יא כאובים! 💪", icon: "/icon-192.png" });
    const { sent, failed } = await sendToSubs(rows, payload);
    return NextResponse.json({ ok: sent > 0, sent, failed, total: rows.length, message: `נשלח ל-${sent} משתמשים` });
  }

  // Default: test push to self only
  const rows = (await db.execute({
    sql: "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
    args: [user.id],
  })).rows as unknown as Sub[];

  if (rows.length === 0) return NextResponse.json({ ok: false, error: "אין subscription — הפעל התראות בדף הבית תחילה" });

  const payload = JSON.stringify({ title: "✅ בדיקת התראות", body: "ההתראות עובדות! 🎉", icon: "/icon-192.png" });
  const { sent, failed } = await sendToSubs(rows, payload);
  return NextResponse.json({ ok: sent > 0, sent, failed, total: rows.length, message: sent > 0 ? "התראת בדיקה נשלחה!" : "כל ה-subscriptions נכשלו ונמחקו" });
}
