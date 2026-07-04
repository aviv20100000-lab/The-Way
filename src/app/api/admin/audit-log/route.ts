import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;

// GET /api/admin/audit-log?limit=100&event=<event_name>
// Coach-only. Returns recent audit log entries for operational visibility.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "coach") {
    return NextResponse.json({ error: "ללא הרשאה" }, { status: 401 });
  }

  await initDb();

  const { searchParams } = req.nextUrl;
  const limitParam = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const eventFilter = searchParams.get("event") ?? null;

  const rows = eventFilter
    ? (await db.execute({
        sql: "SELECT id, event, user_id, ip, metadata, created_at FROM audit_log WHERE event = ? ORDER BY created_at DESC LIMIT ?",
        args: [eventFilter, limit],
      })).rows
    : (await db.execute({
        sql: "SELECT id, event, user_id, ip, metadata, created_at FROM audit_log ORDER BY created_at DESC LIMIT ?",
        args: [limit],
      })).rows;

  return NextResponse.json({ entries: rows, count: rows.length });
}
