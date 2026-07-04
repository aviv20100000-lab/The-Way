import { NextRequest, NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import webpush from "web-push";
import crypto from "crypto";
import { sendTelegramAlert } from "@/lib/telegram";
import { getDailySummary, getYesterdayDayKey, getTodayDayKey } from "@/lib/daily-summary";
import type { DailySummaryItem } from "@/lib/daily-summary";

export const dynamic = "force-dynamic";

function timingSafeCompare(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function buildBody(reportedCount: number, totalClients: number, missingNames: string[]) {
  const missingCount = totalClients - reportedCount;
  const missingPreview = missingNames.join(", ");
  const raw = `${reportedCount}/${totalClients} דיווחו אתמול · ${missingCount} לא דיווחו${missingPreview ? `: ${missingPreview}` : ""}`;
  return raw.length <= 100 ? raw : `${raw.slice(0, 97)}...`;
}

function formatClientLine(item: DailySummaryItem): string {
  if (!item.reported) return `🔴 <b>${item.client_name}</b> — לא דיווח היום`;
  const parts: string[] = [];
  parts.push(`🍽️ ${item.calories}${item.calorie_goal ? `/${item.calorie_goal}` : ""} קל'`);
  parts.push(`💧 ${(item.water_ml / 1000).toFixed(1)}L`);
  parts.push(`👟 ${item.steps.toLocaleString()}`);
  if (item.weight_kg !== null) parts.push(`⚖️ ${item.weight_kg} ק"ג`);
  return `🟢 <b>${item.client_name}</b> — ${parts.join(" · ")}`;
}

// Evening Telegram digest of TODAY's activity (triggered with ?mode=telegram at 22:00)
async function handleTelegramDigest() {
  await initDb();
  const dayKey = getTodayDayKey();
  const coaches = (await db.execute({
    sql: `SELECT id, name FROM users WHERE role = 'coach' ORDER BY name COLLATE NOCASE ASC`,
    args: [],
  })).rows;

  let sent = 0;
  for (const coach of coaches) {
    const summary = await getDailySummary(String(coach.id), dayKey);
    if (summary.length === 0) continue;

    const reported = summary.filter((item) => item.reported).length;
    const lines = summary.map(formatClientLine).join("\n");
    const [year, month, day] = dayKey.split("-");
    const ok = await sendTelegramAlert(
      `📋 <b>סיכום יומי — ${day}.${month}.${year}</b>\n` +
      `דיווחו היום: ${reported}/${summary.length}\n\n` +
      lines
    );
    if (ok) sent++;
  }

  return NextResponse.json({ ok: true, mode: "telegram", day: dayKey, digestsSent: sent });
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

  if (req.nextUrl.searchParams.get("mode") === "telegram") {
    return handleTelegramDigest();
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!.replace(/^ן»¿/, ""),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  await initDb();
  const dayKey = getYesterdayDayKey();
  const coaches = (await db.execute({
    sql: `SELECT id, name FROM users WHERE role = 'coach' ORDER BY name COLLATE NOCASE ASC`,
    args: [],
  })).rows;

  let coachesProcessed = 0;
  let notificationsSent = 0;
  let notificationsFailed = 0;
  let coachesWithClients = 0;

  for (const coach of coaches) {
    const coachId = String(coach.id);
    const summary = await getDailySummary(coachId, dayKey);
    if (summary.length === 0) {
      continue;
    }

    coachesWithClients++;
    const reportedCount = summary.filter((item) => item.reported).length;
    const missingNames = summary.filter((item) => !item.reported).map((item) => item.client_name);
    const body = buildBody(reportedCount, summary.length, missingNames);
    const payload = JSON.stringify({
      title: "📋 סיכום יומי",
      body,
      icon: "/icon-192.png",
    });

    const subs = (await db.execute({
      sql: `SELECT endpoint, p256dh, auth
            FROM push_subscriptions
            WHERE user_id = ?`,
      args: [coachId],
    })).rows;

    if (subs.length === 0) {
      coachesProcessed++;
      continue;
    }

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: String(sub.endpoint),
            keys: {
              p256dh: String(sub.p256dh),
              auth: String(sub.auth),
            },
          },
          payload
        );
        notificationsSent++;
      } catch {
        notificationsFailed++;
        await db.execute({
          sql: "DELETE FROM push_subscriptions WHERE endpoint = ?",
          args: [String(sub.endpoint)],
        });
      }
    }

    coachesProcessed++;
  }

  await sendTelegramAlert(
    `📋 <b>Daily Summary</b>\n` +
    `יום: ${dayKey}\n` +
    `מאמנים עם מתאמנים: ${coachesWithClients}\n` +
    `מאמנים שעובדו: ${coachesProcessed}\n` +
    `נשלחו: ${notificationsSent}\n` +
    `נכשלו: ${notificationsFailed}`
  );

  return NextResponse.json({
    ok: true,
    day: dayKey,
    coachesWithClients,
    coachesProcessed,
    notificationsSent,
    notificationsFailed,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
