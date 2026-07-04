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

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimit = await checkPersistentRateLimit(`client-error:${user.id}:${clientIp}`, "auth");
  if (!rateLimit.allowed) {
    return NextResponse.json({ accepted: true }, { status: 202 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "דיווח לא תקין" }, { status: 400 });
  }

  const name = clean(body.name, 80) || "Error";
  const message = clean(body.message, 600);
  const stack = clean(body.stack, 1400);
  const componentStack = clean(body.componentStack, 1000);
  const path = clean(body.path, 300) || "unknown";
  const userAgent = clean(body.userAgent, 300) || "unknown";

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
    `User: <b>${escapeHtml(user.name)}</b> (${escapeHtml(user.role)})`,
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
