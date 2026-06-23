import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

// GET /api/chat/contacts — returns DM contacts + unread counts
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  try {
    await initDb();

    const coachId =
      user.role === "coach"
        ? user.id
        : ((user as { coach_id?: string }).coach_id ?? null);

    let contacts: { id: string; name: string; role: string }[] = [];
    if (coachId) {
      const membersRes = await db.execute({
        sql: `SELECT id, name, role FROM users
              WHERE (id = ? OR coach_id = ?) AND id != ?
              ORDER BY role DESC, name ASC`,
        args: [coachId, coachId, user.id],
      });
      contacts = membersRes.rows as unknown as { id: string; name: string; role: string }[];
    }

    // Unread DM count per sender
    const unreadRes = await db.execute({
      sql: `SELECT sender_id, COUNT(*) as count
            FROM chat_messages
            WHERE receiver_id = ? AND is_read = 0
            GROUP BY sender_id`,
      args: [user.id],
    });

    const unreadMap: Record<string, number> = {};
    for (const row of unreadRes.rows) {
      unreadMap[row.sender_id as string] = Number(row.count);
    }

    // Group unread: messages sent by others in the same group that are still unread
    let groupUnread = 0;
    if (coachId) {
      const groupUnreadRes = await db.execute({
        sql: `SELECT COUNT(*) as count FROM chat_messages
              WHERE receiver_id IS NULL
                AND sender_id != ?
                AND (sender_id = ? OR sender_id IN (SELECT id FROM users WHERE coach_id = ?))
                AND is_read = 0`,
        args: [user.id, coachId, coachId],
      });
      groupUnread = Number(groupUnreadRes.rows[0]?.count ?? 0);
    }

    return NextResponse.json({ contacts, unreadMap, groupUnread, coachId });
  } catch (err) {
    console.error("[chat/contacts GET]", err);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
