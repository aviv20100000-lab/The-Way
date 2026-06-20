import { NextRequest, NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import webpush from "web-push";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Tel Aviv / central coast
const LAT = 32.08;
const LON = 34.78;
const HOT_THRESHOLD = 30; // °C — below this, no reminder is sent

function buildMessage(temp: number): { title: string; body: string } {
  const t = Math.round(temp);
  if (temp >= 37) {
    return { title: "🔥 שרב!", body: `${t}° בחוץ — חשוב מאוד לשתות הרבה מים, אל תחכה לצמא 💧💧` };
  }
  if (temp >= 33) {
    return { title: "🥵 ממש חם בחוץ", body: `${t}° — שתה עכשיו לפחות כוס מים גדולה 💧` };
  }
  return { title: "🌡️ חם היום", body: `${t}° בחוץ — זמן טוב לכוס מים 💧` };
}

function timingSafeCompare(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

async function handle(req: NextRequest) {
  // Auth: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
  // External cron can pass ?secret=<CRON_SECRET> instead.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const qs = req.nextUrl.searchParams.get("secret");
    const authValid = auth ? timingSafeCompare(auth, `Bearer ${secret}`) : false;
    const qsValid = qs ? timingSafeCompare(qs, secret) : false;
    if (!authValid && !qsValid) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // Current temperature from Open-Meteo (free, no API key)
  let temp: number;
  try {
    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m`,
      { cache: "no-store" }
    );
    const w = await wRes.json();
    temp = Number(w?.current?.temperature_2m);
    if (!Number.isFinite(temp)) throw new Error("no temperature");
  } catch (e) {
    return NextResponse.json(
      { error: "weather fetch failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  if (temp < HOT_THRESHOLD) {
    return NextResponse.json({ skipped: true, temp, reason: "not hot enough" });
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!.replace(/^﻿/, ""),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  await initDb();
  const subs = (await db.execute({
    sql: `SELECT ps.* FROM push_subscriptions ps
          JOIN users u ON u.id = ps.user_id
          WHERE u.role = 'client'`,
  })).rows;

  const { title, body } = buildMessage(temp);
  const payload = JSON.stringify({ title, body, icon: "/icon-192.png" })
    .replace(/[^\x00-\x7F]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
        payload
      );
      sent++;
    } catch {
      await db.execute({ sql: "DELETE FROM push_subscriptions WHERE endpoint=?", args: [sub.endpoint as string] });
    }
  }

  return NextResponse.json({ ok: true, temp, sent });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
