import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  await initDb();

  const clientId = req.nextUrl.searchParams.get("clientId")?.trim() ?? "";
  if (clientId) {
    const ownedClient = await db.execute({
      sql: "SELECT id, name FROM users WHERE id = ? AND coach_id = ? AND role = 'client'",
      args: [clientId, coach.id],
    });
    const client = ownedClient.rows[0];
    if (!client) return NextResponse.json({ error: "המתאמן לא נמצא" }, { status: 404 });

    const messages = await db.execute({
      sql: `SELECT id, role, content, created_at
            FROM assistant_messages
            WHERE user_id = ?
            ORDER BY created_at ASC, id ASC
            LIMIT 120`,
      args: [clientId],
    });

    return NextResponse.json({ client, messages: messages.rows });
  }

  const conversations = await db.execute({
    sql: `SELECT u.id AS client_id,
                 u.name AS client_name,
                 COUNT(am.id) AS message_count,
                 MAX(am.created_at) AS last_message_at,
                 (
                   SELECT content
                   FROM assistant_messages latest
                   WHERE latest.user_id = u.id
                   ORDER BY latest.created_at DESC, latest.id DESC
                   LIMIT 1
                 ) AS last_message
          FROM users u
          LEFT JOIN assistant_messages am ON am.user_id = u.id
          WHERE u.role = 'client' AND u.coach_id = ?
          GROUP BY u.id, u.name
          ORDER BY (last_message_at IS NULL), last_message_at DESC, u.name COLLATE NOCASE ASC`,
    args: [coach.id],
  });

  return NextResponse.json({ conversations: conversations.rows });
}
