import { randomUUID } from "crypto";
import db, { initDb } from "@/lib/db";

export type AuditEvent =
  | "login_failed"
  | "login_success"
  | "password_reset_requested"
  | "password_reset_success"
  | "password_reset_invalid_token"
  | "profile_password_changed"
  | "cross_user_probe_blocked";

function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  const first = ip.split(",")[0]?.trim() || "unknown";
  if (first.includes(":")) {
    const parts = first.split(":").filter(Boolean);
    return `${parts.slice(0, 4).join(":")}:****`;
  }
  const parts = first.split(".");
  if (parts.length !== 4) return first;
  return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
}

export async function logAuditEvent(
  event: AuditEvent,
  opts: {
    userId?: string | null;
    ip?: string | null;
    metadata?: string | null;
  } = {}
): Promise<void> {
  try {
    await initDb();
    await db.execute({
      sql: "INSERT INTO audit_log (id, event, user_id, ip, metadata, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      args: [
        randomUUID(),
        event,
        opts.userId ?? null,
        opts.ip ? maskIp(opts.ip) : null,
        opts.metadata ? opts.metadata.slice(0, 255) : null,
      ],
    });
  } catch {
    // Never let audit logging break the request
  }
}
