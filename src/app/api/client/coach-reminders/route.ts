import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

const VALID_KINDS = new Set(["goals", "menu"]);

export async function POST(req: NextRequest) {
  const client = await getSessionUser();
  if (!client || client.role !== "client") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  if (!client.coach_id) {
    return NextResponse.json({ error: "לא משויך מאמן למשתמש הזה" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!VALID_KINDS.has(kind)) {
    return NextResponse.json({ error: "סוג תזכורת לא תקין" }, { status: 400 });
  }

  await initDb();

  const recent = await db.execute({
    sql: `SELECT id
          FROM coach_requests
          WHERE coach_id = ? AND client_id = ? AND kind = ?
            AND created_at >= datetime('now', '-12 hours')
          ORDER BY created_at DESC
          LIMIT 1`,
    args: [client.coach_id, client.id, kind],
  });
  if (recent.rows.length > 0) {
    return NextResponse.json({ ok: true, already_sent: true });
  }

  const defaultMessage = kind === "menu"
    ? "המתאמן ביקש להעלות לו תפריט."
    : "המתאמן ביקש לעדכן לו יעדים כמו קלוריות, חלבון או יעד משקל.";

  await db.execute({
    sql: `INSERT INTO coach_requests (id, coach_id, client_id, kind, message, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    args: [uuid(), client.coach_id, client.id, kind, defaultMessage],
  });

  return NextResponse.json({ ok: true });
}
