import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

function resolveCoachId(user: { id: string; role: string; coach_id?: string }) {
  return user.role === "coach" ? user.id : (user.coach_id ?? null);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  try {
    await initDb();

    const coachId = resolveCoachId(user as Parameters<typeof resolveCoachId>[0]);

    const contactsPromise = coachId
      ? db.execute({
          sql: `SELECT id, name, role, username FROM users
                WHERE (id = ? OR coach_id = ?) AND id != ?
                ORDER BY role DESC, name ASC`,
          args: [coachId, coachId, user.id],
        })
      : Promise.resolve({ rows: [] });

    const unreadPromise = db.execute({
      sql: `SELECT sender_id, COUNT(*) as count
            FROM chat_messages
            WHERE receiver_id = ? AND is_read = 0
            GROUP BY sender_id`,
      args: [user.id],
    });

    const groupUnreadPromise = coachId
      ? db.execute({
          sql: `SELECT COUNT(*) as count FROM chat_messages
                WHERE receiver_id IS NULL
                  AND sender_id != ?
                  AND (sender_id = ? OR sender_id IN (SELECT id FROM users WHERE coach_id = ?))
                  AND is_read = 0`,
          args: [user.id, coachId, coachId],
        })
      : Promise.resolve({ rows: [{ count: 0 }] });

    const groupMessagesPromise = coachId
      ? db.execute({
          sql: `SELECT m.id, m.content, m.is_read,
                       m.sender_id, u.name as sender_name, u.username as sender_username,
                       strftime('%Y-%m-%dT%H:%M:%SZ', m.sent_at) as sent_at
                FROM chat_messages m
                JOIN users u ON u.id = m.sender_id
                WHERE m.receiver_id IS NULL
                  AND (
                    m.sender_id = ?
                    OR m.sender_id IN (SELECT id FROM users WHERE coach_id = ?)
                  )
                ORDER BY m.sent_at ASC
                LIMIT 100`,
          args: [coachId, coachId],
        })
      : Promise.resolve({ rows: [] });

    const [contactsRes, unreadRes, groupUnreadRes, groupMessagesRes] = await Promise.all([
      contactsPromise,
      unreadPromise,
      groupUnreadPromise,
      groupMessagesPromise,
    ]);

    if (coachId) {
      await db.execute({
        sql: `UPDATE chat_messages SET is_read = 1
              WHERE receiver_id IS NULL
                AND sender_id != ?
                AND (sender_id = ? OR sender_id IN (SELECT id FROM users WHERE coach_id = ?))
                AND is_read = 0`,
        args: [user.id, coachId, coachId],
      });
    }

    const unreadMap: Record<string, number> = {};
    for (const row of unreadRes.rows) {
      unreadMap[row.sender_id as string] = Number(row.count);
    }

    return NextResponse.json({
      user,
      contacts: contactsRes.rows,
      unreadMap,
      groupUnread: Number(groupUnreadRes.rows[0]?.count ?? 0),
      messages: groupMessagesRes.rows,
    });
  } catch (error) {
    console.error("[chat/bootstrap GET]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
