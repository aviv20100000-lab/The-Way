import db, { initDb } from "@/lib/db";
import { sendTelegramAlert } from "@/lib/telegram";

type SecurityAlertSeverity = "medium" | "high";

function normalizeIp(rawIp: string | null | undefined): string {
  if (!rawIp) return "unknown";
  return rawIp.split(",")[0]?.trim() || "unknown";
}

function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";

  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return `${parts.slice(0, 4).join(":")}:****`;
  }

  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
}

async function shouldSendAlert(key: string, cooldownMs: number): Promise<boolean> {
  await initDb();

  const now = Date.now();
  const namespacedKey = `alert:${key}`;
  const existing = await db.execute({
    sql: "SELECT count, reset_at FROM rate_limits WHERE key = ?",
    args: [namespacedKey],
  });

  const row = existing.rows[0] as { reset_at?: number } | undefined;
  if (!row || typeof row.reset_at !== "number" || now > row.reset_at) {
    await db.execute({
      sql: `
        INSERT INTO rate_limits (key, count, reset_at)
        VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at
      `,
      args: [namespacedKey, now + cooldownMs],
    });
    return true;
  }

  return false;
}

export async function sendSecurityAlert(params: {
  event: string;
  severity?: SecurityAlertSeverity;
  ip?: string | null;
  identifier?: string | null;
  details?: string | null;
  cooldownMs?: number;
}): Promise<void> {
  const {
    event,
    severity = "medium",
    ip,
    identifier,
    details,
    cooldownMs = 10 * 60 * 1000,
  } = params;

  const normalizedIp = normalizeIp(ip);
  const dedupeKey = `${event}:${normalizedIp}:${identifier ?? ""}`;
  const shouldSend = await shouldSendAlert(dedupeKey, cooldownMs);
  if (!shouldSend) return;

  const lines = [
    "🚨 <b>Security alert</b>",
    `Event: <b>${event}</b>`,
    `Severity: <b>${severity}</b>`,
    `IP: <code>${maskIp(normalizedIp)}</code>`,
  ];

  if (identifier) {
    lines.push(`Identifier: <code>${identifier.slice(0, 80)}</code>`);
  }

  if (details) {
    lines.push(`Details: <code>${details.slice(0, 160)}</code>`);
  }

  lines.push(`Time: <code>${new Date().toISOString()}</code>`);

  await sendTelegramAlert(lines.join("\n"));
}
