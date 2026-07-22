import { NextRequest, NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import webpush from "web-push";
import crypto from "crypto";
import { sendTelegramAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Tel Aviv / central coast
const LAT = 32.08;
const LON = 34.78;
const HOT_THRESHOLD = 28; // °C — below this, no reminder is sent

function buildMessage(temp: number): { title: string; body: string } {
  const t = Math.round(temp);
  if (temp >= 37) {
    return { title: "🔥 שרב!", body: `${t}° בחוץ — חשוב מאוד לשתות הרבה מים, אל תחכה לצמא 💧💧` };
  }
  if (temp >= 33) {
    return { title: "🥵 ממש חם בחוץ", body: `${t}° — שתה עכשיו לפחות כוס מים גדולה 💧` };
  }
  if (temp >= 30) {
    return { title: "🌡️ חם היום", body: `${t}° בחוץ — זמן טוב לכוס מים 💧` };
  }
  return { title: "💧 תזכורת שתייה", body: `${t}° בחוץ — אל תשכח לשתות מים היום` };
}

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

  // Current temperature from Open-Meteo (free, no API key)
  let temp: number;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let wRes: Response;
    try {
      wRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m`,
        { cache: "no-store", signal: controller.signal }
      );
    } finally {
      clearTimeout(timeout);
    }
    if (!wRes.ok) throw new Error(`weather API returned ${wRes.status}`);
    const w = await wRes.json();
    temp = Number(w?.current?.temperature_2m);
    if (!Number.isFinite(temp)) throw new Error("no temperature in response");
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("weather fetch error:", errMsg);
    await sendTelegramAlert(`⚠️ <b>Water Reminder</b> — כשל בטעינת מזג האוויר\n${errMsg}`);
    return NextResponse.json({ error: "weather fetch failed" }, { status: 502 });
  }

  if (temp < HOT_THRESHOLD) {
    await sendTelegramAlert(
      `ℹ️ <b>Water Reminder</b> — לא נשלח\n` +
      `🌡️ טמפרטורה: ${Math.round(temp)}° (מתחת לסף ${HOT_THRESHOLD}°)`
    );
    return NextResponse.json({ skipped: true, temp, reason: "not hot enough" });
  }

  try {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL!.replace(/^﻿/, ""),
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    await initDb();
    const subs = (await db.execute({
      sql: `SELECT ps.*, u.name AS user_name, u.username AS user_username FROM push_subscriptions ps
            JOIN users u ON u.id = ps.user_id
            WHERE u.role = 'client'`,
    })).rows;

    const { title, body } = buildMessage(temp);
    const payload = JSON.stringify({ title, body, icon: "/icon-192.png" });

    let sent = 0;
    let failed = 0;
    const failedNames: string[] = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
          payload
        );
        sent++;
      } catch {
        failed++;
        failedNames.push(`${sub.user_name} (${sub.user_username})`);
        await db.execute({ sql: "DELETE FROM push_subscriptions WHERE endpoint=?", args: [sub.endpoint as string] });
      }
    }

    await sendTelegramAlert(
      `✅ <b>Water Reminder</b> — נשלח\n` +
      `🌡️ טמפרטורה: ${Math.round(temp)}°\n` +
      `📨 נשלח ל: ${sent} משתמשים\n` +
      `❌ נכשל (subscription נמחקה): ${failed}${failedNames.length ? ` — ${failedNames.join(", ")}` : ""}\n` +
      `📋 סה"כ subscriptions: ${subs.length}`
    );

    return NextResponse.json({ ok: true, temp, sent, failed });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("water-reminder send error:", errMsg);
    await sendTelegramAlert(`🔥 <b>Water Reminder</b> — שגיאה בשליחה\n${errMsg}`);
    return NextResponse.json({ error: "send failed", detail: errMsg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
