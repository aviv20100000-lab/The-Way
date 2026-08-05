import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { getPrivateChatContacts, isInDefaultGroup, resolveCoachId } from "@/lib/chat-group";
import { defaultGroupReadKey } from "@/lib/chat-reads";

// GET /api/chat/contacts — returns DM contacts + unread counts
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  try {
    await initDb();

    const coachId = resolveCoachId(user as Parameters<typeof resolveCoachId>[0]);
    const contacts = await getPrivateChatContacts(user as Parameters<typeof getPrivateChatContacts>[0]);

    // Unread DM count per sender
    const unreadRes = await db.execute({
      sql: `SELECT sender_id, COUNT(*) as count
            FROM chat_messages
            WHERE receiver_id = ? AND is_read = 0
            GROUP BY sender_id`,
      args: [user.id],
    });

    const allowedContactIds = new Set(contacts.map((contact) => contact.id));
    const unreadMap: Record<string, number> = {};
    for (const row of unreadRes.rows) {
      const senderId = String(row.sender_id);
      if (allowedContactIds.has(senderId)) unreadMap[senderId] = Number(row.count);
    }

    // Group unread: messages sent by others in the same group that are still unread
    const inDefaultGroup = coachId ? await isInDefaultGroup(user) : false;
    let groupUnread = 0;
    if (coachId && inDefaultGroup) {
      const groupUnreadRes = await db.execute({
        sql: `SELECT COUNT(*) as count FROM chat_messages
              WHERE receiver_id IS NULL
                AND group_id IS NULL
                AND sender_id != ?
                AND (sender_id = ? OR sender_id IN (SELECT id FROM users WHERE coach_id = ?))
                AND sent_at > COALESCE(
                  (SELECT last_read_at FROM chat_group_reads WHERE user_id = ? AND channel_key = ?),
                  '1970-01-01 00:00:00'
                )`,
        args: [user.id, coachId, coachId, user.id, defaultGroupReadKey(coachId)],
      });
      groupUnread = Number(groupUnreadRes.rows[0]?.count ?? 0);
    }

    const namedGroupsRes = user.role === "coach"
      ? await db.execute({
          sql: `SELECT g.id, g.name, g.image_url AS imageUrl,
                       (SELECT COUNT(*) FROM chat_messages m
                        WHERE m.group_id = g.id
                          AND m.sender_id != ?
                          AND m.sent_at > COALESCE(
                            (SELECT last_read_at FROM chat_group_reads
                             WHERE user_id = ? AND channel_key = 'named:' || g.id),
                            '1970-01-01 00:00:00'
                          )) AS unread_count
                FROM chat_groups g
                WHERE g.coach_id = ?
                ORDER BY g.created_at DESC`,
          args: [user.id, user.id, user.id],
        })
      : await db.execute({
          sql: `SELECT g.id, g.name, g.image_url AS imageUrl,
                       (SELECT COUNT(*) FROM chat_messages m
                        WHERE m.group_id = g.id
                          AND m.sender_id != ?
                          AND m.sent_at > COALESCE(
                            (SELECT last_read_at FROM chat_group_reads
                             WHERE user_id = ? AND channel_key = 'named:' || g.id),
                            '1970-01-01 00:00:00'
                          )) AS unread_count
                FROM chat_groups g
                JOIN chat_group_members gm ON gm.group_id = g.id
                WHERE gm.user_id = ?
                ORDER BY g.created_at DESC`,
          args: [user.id, user.id, user.id],
        });

    const defaultGroupNameRes = coachId
      ? await db.execute({ sql: "SELECT default_group_name FROM users WHERE id = ?", args: [coachId] })
      : { rows: [] as { default_group_name?: string | null }[] };
    const defaultGroupName = (defaultGroupNameRes.rows[0]?.default_group_name as string | null | undefined) ?? null;

    const namedGroups = namedGroupsRes.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      imageUrl: row.imageUrl ? String(row.imageUrl) : null,
      unreadCount: Number(row.unread_count ?? 0),
    }));

    return NextResponse.json({ contacts, unreadMap, groupUnread, namedGroups, defaultGroupName, inDefaultGroup, coachId });
  } catch (err) {
    console.error("[chat/contacts GET]", err);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
