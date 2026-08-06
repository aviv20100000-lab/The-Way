import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { getPrivateChatContacts, isInDefaultGroup, resolveCoachId } from "@/lib/chat-group";
import { attachChatReactions } from "@/lib/chat-reactions";
import { defaultGroupReadKey } from "@/lib/chat-reads";
import { toAvatarProxyUrl } from "@/lib/avatar-url";

type MessageRow = { id: string } & Record<string, unknown>;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  try {
    await initDb();

    const coachId = resolveCoachId(user as Parameters<typeof resolveCoachId>[0]);
    const inDefaultGroup = await isInDefaultGroup(user);

    const selfRes = await db.execute({ sql: "SELECT dm_coach_only FROM users WHERE id = ?", args: [user.id] });
    const dmCoachOnly = Number(selfRes.rows[0]?.dm_coach_only ?? 0) === 1;
    const canSeeDefaultGroup = Boolean(coachId) && inDefaultGroup && !dmCoachOnly;
    const defaultGroupKey = coachId ? defaultGroupReadKey(coachId) : "";

    const contactsPromise = getPrivateChatContacts(user as Parameters<typeof getPrivateChatContacts>[0]);

    const unreadPromise = db.execute({
      sql: `SELECT sender_id, COUNT(*) as count
            FROM chat_messages
            WHERE receiver_id = ? AND is_read = 0
            GROUP BY sender_id`,
      args: [user.id],
    });

    const groupUnreadPromise = canSeeDefaultGroup
      ? db.execute({
          sql: `SELECT COUNT(*) as count FROM chat_messages
                WHERE receiver_id IS NULL
                  AND group_id IS NULL
                  AND sender_id != ?
                  AND (sender_id = ? OR sender_id IN (SELECT id FROM users WHERE coach_id = ?))
                  AND sent_at > COALESCE(
                    (SELECT last_read_at FROM chat_group_reads WHERE user_id = ? AND channel_key = ?),
                    '1970-01-01 00:00:00'
                  )`,
          args: [user.id, coachId, coachId, user.id, defaultGroupKey],
        })
      : Promise.resolve({ rows: [{ count: 0 }] });

    const groupMessagesPromise = canSeeDefaultGroup
      ? db.execute({
          sql: `SELECT m.id, m.content, m.image_url, m.is_read,
                       m.sender_id, u.name as sender_name, u.username as sender_username,
                       u.avatar_url as sender_avatar_url,
                       strftime('%Y-%m-%dT%H:%M:%SZ', m.sent_at) as sent_at
                FROM chat_messages m
                JOIN users u ON u.id = m.sender_id
                WHERE m.receiver_id IS NULL
                  AND m.group_id IS NULL
                  AND (
                    m.sender_id = ?
                    OR m.sender_id IN (SELECT id FROM users WHERE coach_id = ?)
                  )
                ORDER BY m.sent_at DESC
                LIMIT 100`,
          args: [coachId, coachId],
        })
      : Promise.resolve({ rows: [] });

    const namedGroupsPromise = user.role === "coach"
      ? db.execute({
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
      : db.execute({
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

    const selfAvatarPromise = db.execute({
      sql: "SELECT avatar_url FROM users WHERE id = ?",
      args: [user.id],
    });

    const defaultGroupNamePromise = coachId
      ? db.execute({ sql: "SELECT default_group_name FROM users WHERE id = ?", args: [coachId] })
      : Promise.resolve({ rows: [] });

    const [contactsRes, unreadRes, groupUnreadRes, groupMessagesRes, namedGroupsRes, selfAvatarRes, defaultGroupNameRes] = await Promise.all([
      contactsPromise,
      unreadPromise,
      groupUnreadPromise,
      groupMessagesPromise,
      namedGroupsPromise,
      selfAvatarPromise,
      defaultGroupNamePromise,
    ]);

    const allowedContactIds = new Set(contactsRes.map((contact) => contact.id));
    const unreadMap: Record<string, number> = {};
    for (const row of unreadRes.rows) {
      const senderId = String(row.sender_id);
      if (allowedContactIds.has(senderId)) unreadMap[senderId] = Number(row.count);
    }

    const recentRows = Array.from(groupMessagesRes.rows).reverse() as unknown as MessageRow[];
    const reactedMessages = await attachChatReactions(recentRows, user.id);
    const messages = reactedMessages.map((message) => ({
      ...message,
      sender_avatar_url: toAvatarProxyUrl(String(message.sender_id), message.sender_avatar_url as string | null),
    }));
    const namedGroups = namedGroupsRes.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      imageUrl: row.imageUrl ? String(row.imageUrl) : null,
      unreadCount: Number(row.unread_count ?? 0),
    }));

    return NextResponse.json({
      user: { ...user, avatar_url: toAvatarProxyUrl(user.id, (selfAvatarRes.rows[0]?.avatar_url as string | null) ?? null) },
      contacts: contactsRes,
      unreadMap,
      groupUnread: Number(groupUnreadRes.rows[0]?.count ?? 0),
      namedGroups,
      defaultGroupName: (defaultGroupNameRes.rows[0]?.default_group_name as string | null) ?? null,
      inDefaultGroup: canSeeDefaultGroup,
      messages,
    });
  } catch (error) {
    console.error("[chat/bootstrap GET]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
