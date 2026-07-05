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
  const perfPhase = body.phase === "stuck" ? "stuck" : "final";
  const user = await getSessionUser();
  if (!user && !isPerfReport) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimit = await checkPersistentRateLimit(
    `client-${isPerfReport ? `perf-${perfPhase}` : "error"}:${user?.id || "anonymous"}:${clientIp}`,
    "auth"
  );
  if (!rateLimit.allowed) {
    return NextResponse.json({ accepted: true }, { status: 202 });
  }

  const path = clean(body.path, 300) || "unknown";
  const userAgent = clean(body.userAgent, 300) || "unknown";

  if (isPerfReport) {
    const phase = perfPhase;
    const duration = cleanNumber(body.duration, 300_000);
    if (duration === null || (phase === "final" && duration <= 8000)) {
      return NextResponse.json({ error: "דיווח לא תקין" }, { status: 400 });
    }

    const timing = (label: string, value: unknown, max = 300_000) => {
      const number = cleanNumber(value, max);
      return `${label}: <code>${number === null ? "unknown" : Math.round(number)}</code>`;
    };
    const details = [
      phase === "stuck" ? "⏳ <b>Stuck mid-load</b>" : "🐢 <b>Slow page load</b>",
      `User: <b>${escapeHtml(user?.name || "Anonymous")}</b>${user ? ` (${escapeHtml(user.role)})` : ""}`,
      `Path: <code>${escapeHtml(path)}</code>`,
      `Ready state: <code>${escapeHtml(clean(body.readyState, 30) || "unknown")}</code>`,
      `Visibility: <code>${escapeHtml(clean(body.visibilityState, 30) || "unknown")}</code>`,
      timing("Duration ms", duration),
      timing("DNS ms", body.dns),
      timing("Connect ms", body.connect),
      timing("TTFB ms", body.ttfb),
      timing("DOM interactive ms", body.domInteractive),
      timing("DOMContentLoaded ms", body.domContentLoaded),
      timing("DOM complete ms", body.domComplete),
      timing("Load event start ms", body.loadEventStart),
      timing("Load event end ms", body.loadEventEnd),
      timing("First paint ms", body.firstPaint),
      timing("First contentful paint ms", body.firstContentfulPaint),
      timing("Transfer bytes", body.transferSize, 100_000_000),
      timing("Resource count", body.resourceCount, 10_000),
      `Connection: <code>${escapeHtml(clean(body.effectiveType, 30) || "unknown")}</code>`,
      `Downlink Mbps: <code>${cleanNumber(body.downlink, 10_000) ?? "unknown"}</code>`,
      `Device: <code>${escapeHtml(userAgent)}</code>`,
    ];

    if (Array.isArray(body.visibilityTimeline)) {
      details.push("Visibility timeline:");
      for (const entry of body.visibilityTimeline.slice(0, 20)) {
        if (typeof entry !== "object" || entry === null) continue;
        const point = entry as Record<string, unknown>;
        const t = cleanNumber(point.t, 300_000);
        const state = clean(point.state, 30) || "unknown";
        const event = clean(point.event, 30) || "unknown";
        const persisted = typeof point.persisted === "boolean" ? `, persisted=${point.persisted}` : "";
        details.push(
          `• <code>${t === null ? "?" : Math.round(t)}ms ${escapeHtml(event)}: ${escapeHtml(state)}${persisted}</code>`
        );
      }
    }

    if (Array.isArray(body.scriptStates)) {
      details.push("Script states at probe:");
      for (const entry of body.scriptStates.slice(0, 20)) {
        if (typeof entry !== "object" || entry === null) continue;
        const script = entry as Record<string, unknown>;
        const url = clean(script.url, 140) || "unknown";
        const completed = script.completed === true;
        const duration = cleanNumber(script.duration, 300_000);
        details.push(
          `• <code>${escapeHtml(url)}</code> — ${completed ? `${duration === null ? "?" : Math.round(duration)}ms` : "PENDING"}`
        );
      }
    }

    if (Array.isArray(body.slowResources)) {
      details.push("Slowest resources:");
      for (const entry of body.slowResources.slice(0, 8)) {
        if (typeof entry !== "object" || entry === null) continue;
        const r = entry as Record<string, unknown>;
        const url = clean(r.url, 120) || "unknown";
        const initiatorType = clean(r.initiatorType, 40) || "unknown";
        const dur = cleanNumber(r.duration, 300_000);
        const start = cleanNumber(r.start, 300_000);
        const bytes = cleanNumber(r.bytes, 100_000_000);
        details.push(
          `• <code>${escapeHtml(url)}</code> — ${dur === null ? "?" : Math.round(dur)}ms (${escapeHtml(initiatorType)}, start ${start === null ? "?" : Math.round(start)}ms, ${bytes === null ? "?" : bytes}B)`
        );
      }
    }

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
