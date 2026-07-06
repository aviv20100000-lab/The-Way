import { NextRequest, NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import webpush from "web-push";
import crypto from "crypto";
import { sendTelegramAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

function timingSafeCompare(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// Runs every Sunday. Calendar-based cadence, the same for every client
// regardless of when they signed up — weekly clients get a reminder every
// Sunday, biweekly clients get one every other Sunday.
function isDueThisWeek(frequencyWeeks: number): boolean {
  if (frequencyWeeks <= 1) return true;
  const weeksSinceEpoch = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  return weeksSinceEpoch % frequencyWeeks === 0;
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  if (!auth || !timingSafeCompare(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!.replace(/^﻿/, ""),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  await initDb();
  const rows = (await db.execute({
    sql: `SELECT ps.endpoint, ps.p256dh, ps.auth, g.weigh_in_frequency_weeks
          FROM push_subscriptions ps
          JOIN users u ON u.id = ps.user_id
          JOIN goals g ON g.user_id = u.id
          WHERE u.role = 'client' AND g.weigh_in_frequency_weeks IN (1, 2)`,
  })).rows;

  const due = rows.filter((row) => isDueThisWeek(row.weigh_in_frequency_weeks as number));

  const payload = JSON.stringify({
    title: "⚖️ זמן להישקל",
    body: "מיד אחרי שקמת, לפני ששתית מים — ככה מקבלים את המספר הכי מדויק 💧🚽",
    icon: "/icon-192.png",
  });

  let sent = 0;
  let failed = 0;
  for (const row of due) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint as string, keys: { p256dh: row.p256dh as string, auth: row.auth as string } },
        payload
      );
      sent++;
    } catch {
      failed++;
      await db.execute({ sql: "DELETE FROM push_subscriptions WHERE endpoint = ?", args: [row.endpoint as string] });
    }
  }

  await sendTelegramAlert(
    `⚖️ <b>Weigh-in Reminder</b>\n` +
    `📨 נשלח ל: ${sent} מתאמנים\n` +
    `❌ נכשל: ${failed}\n` +
    `📋 רלוונטיים השבוע: ${due.length} מתוך ${rows.length} עם תזכורת מוגדרת`
  );

  return NextResponse.json({ ok: true, sent, failed, dueThisWeek: due.length, totalConfigured: rows.length });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
