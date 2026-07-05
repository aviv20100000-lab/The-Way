import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { checkPersistentRateLimit } from "@/lib/ratelimit";
import { sendTelegramAlert } from "@/lib/telegram";

const DEDUPE_MS = 30 * 60 * 1000;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function clean(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanNumber(value: unknown, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(value, max))
    : null;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "דיווח לא תקין" }, { status: 400 });
  }

  const isPerfReport = body.type === "perf";
  const user = await getSessionUser();
  if (!user && !isPerfReport) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimit = await checkPersistentRateLimit(
    `client-${isPerfReport ? "perf" : "error"}:${user?.id || "anonymous"}:${clientIp}`,
    "auth"
  );
  if (!rateLimit.allowed) {
    return NextResponse.json({ accepted: true }, { status: 202 });
  }

  const path = clean(body.path, 300) || "unknown";
  const userAgent = clean(body.userAgent, 300) || "unknown";

  if (isPerfReport) {
    const duration = cleanNumber(body.duration, 300_000);
    if (duration === null || duration <= 8000) {
      return NextResponse.json({ error: "דיווח לא תקין" }, { status: 400 });
    }

    const timing = (label: string, value: unknown, max = 300_000) => {
      const number = cleanNumber(value, max);
      return `${label}: <code>${number === null ? "unknown" : Math.round(number)}</code>`;
    };
    const details = [
      "🐢 <b>Slow page load</b>",
      `User: <b>${escapeHtml(user?.name || "Anonymous")}</b>${user ? ` (${escapeHtml(user.role)})` : ""}`,
      `Path: <code>${escapeHtml(path)}</code>`,
      timing("Duration ms", duration),
      timing("DNS ms", body.dns),
      timing("Connect ms", body.connect),
      timing("TTFB ms", body.ttfb),
      timing("DOMContentLoaded ms", body.domContentLoaded),
      timing("Load event end ms", body.loadEventEnd),
      timing("Transfer bytes", body.transferSize, 100_000_000),
      `Connection: <code>${escapeHtml(clean(body.effectiveType, 30) || "unknown")}</code>`,
      `Downlink Mbps: <code>${cleanNumber(body.downlink, 10_000) ?? "unknown"}</code>`,
      `Device: <code>${escapeHtml(userAgent)}</code>`,
    ];

    await sendTelegramAlert(details.join("\n"));
    return NextResponse.json(
      { accepted: true },
      { status: 202, headers: { "Cache-Control": "no-store" } }
    );
  }

  const name = clean(body.name, 80) || "Error";
  const message = clean(body.message, 600);
  const stack = clean(body.stack, 1400);
  const componentStack = clean(body.componentStack, 1000);

  if (!message) {
    return NextResponse.json({ error: "דיווח לא תקין" }, { status: 400 });
  }

  const fingerprint = crypto
    .createHash("sha256")
    .update(`${name}\n${message}\n${componentStack}`)
    .digest("hex")
    .slice(0, 24);
  const dedupeKey = `alert:client-error:${fingerprint}`;
  const now = Date.now();

  await initDb();
  const existing = await db.execute({
    sql: "SELECT reset_at FROM rate_limits WHERE key = ?",
    args: [dedupeKey],
  });
  const resetAt = existing.rows[0]?.reset_at;
  if (typeof resetAt === "number" && now <= resetAt) {
    return NextResponse.json({ accepted: true, duplicate: true }, { status: 202 });
  }

  await db.execute({
    sql: `INSERT INTO rate_limits (key, count, reset_at)
          VALUES (?, 1, ?)
          ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at`,
    args: [dedupeKey, now + DEDUPE_MS],
  });

  const details = [
    "🚨 <b>Client app error</b>",
    `User: <b>${escapeHtml(user!.name)}</b> (${escapeHtml(user!.role)})`,
    `Path: <code>${escapeHtml(path)}</code>`,
    `Error: <code>${escapeHtml(`${name}: ${message}`)}</code>`,
    `Device: <code>${escapeHtml(userAgent)}</code>`,
    `Fingerprint: <code>${fingerprint}</code>`,
  ];

  if (componentStack) details.push(`Component stack:\n<pre>${escapeHtml(componentStack)}</pre>`);
  if (stack) details.push(`Stack:\n<pre>${escapeHtml(stack)}</pre>`);

  await sendTelegramAlert(details.join("\n"));
  return NextResponse.json(
    { accepted: true },
    { status: 202, headers: { "Cache-Control": "no-store" } }
  );
}
