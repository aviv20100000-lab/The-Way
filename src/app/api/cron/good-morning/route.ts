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
  const subs = (await db.execute({
    sql: `SELECT ps.*, u.name AS user_name, u.username AS user_username FROM push_subscriptions ps
          JOIN users u ON u.id = ps.user_id`,
  })).rows;

  const payload = JSON.stringify({
    title: "🌅 בוקר טוב!",
    body: "בוקר טוב יא כאובים! 💪",
    icon: "/icon-192.png",
  });

  let sent = 0;
  let failed = 0;
  const failedNames: string[] = [];
  for (const sub of subs) {
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
      failedNames.push(`${sub.user_name} (${sub.user_username})`);
      await db.execute({
        sql: "DELETE FROM push_subscriptions WHERE endpoint = ?",
        args: [sub.endpoint as string],
      });
    }
  }

  await sendTelegramAlert(
    `☀️ <b>Good Morning</b>\n` +
    `📨 נשלח ל: ${sent} משתמשים\n` +
    `❌ נכשל: ${failed}${failedNames.length ? ` — ${failedNames.join(", ")}` : ""}\n` +
    `📋 סה"כ: ${subs.length}`
  );

  return NextResponse.json({ ok: true, sent, failed });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
