import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { isInDefaultGroup, resolveCoachId } from "@/lib/chat-group";
import { attachChatReactions } from "@/lib/chat-reactions";

type MessageRow = { id: string } & Record<string, unknown>;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  try {
    await initDb();

    const coachId = resolveCoachId(user as Parameters<typeof resolveCoachId>[0]);
    const inDefaultGroup = await isInDefaultGroup(user);
    const canSeeDefaultGroup = Boolean(coachId) && inDefaultGroup;

    const contactsPromise = coachId
      ? db.execute({
          sql: `SELECT id, name, role, username, avatar_url FROM users
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

    const groupUnreadPromise = canSeeDefaultGroup
      ? db.execute({
          sql: `SELECT COUNT(*) as count FROM chat_messages
                WHERE receiver_id IS NULL
                  AND group_id IS NULL
                  AND sender_id != ?
                  AND (sender_id = ? OR sender_id IN (SELECT id FROM users WHERE coach_id = ?))
                  AND is_read = 0`,
          args: [user.id, coachId, coachId],
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
                ORDER BY m.sent_at ASC
                LIMIT 100`,
          args: [coachId, coachId],
        })
      : Promise.resolve({ rows: [] });

    const namedGroupsPromise = user.role === "coach"
      ? db.execute({
          sql: "SELECT id, name, image_url AS imageUrl FROM chat_groups WHERE coach_id = ? ORDER BY created_at DESC",
          args: [user.id],
        })
      : db.execute({
          sql: `SELECT g.id, g.name, g.image_url AS imageUrl
                FROM chat_groups g
                JOIN chat_group_members gm ON gm.group_id = g.id
                WHERE gm.user_id = ?
                ORDER BY g.created_at DESC`,
          args: [user.id],
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

    if (canSeeDefaultGroup) {
      await db.execute({
        sql: `UPDATE chat_messages SET is_read = 1
              WHERE receiver_id IS NULL
                AND group_id IS NULL
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

    const messages = await attachChatReactions(groupMessagesRes.rows as unknown as MessageRow[], user.id);

    return NextResponse.json({
      user: { ...user, avatar_url: selfAvatarRes.rows[0]?.avatar_url ?? null },
      contacts: contactsRes.rows,
      unreadMap,
      groupUnread: Number(groupUnreadRes.rows[0]?.count ?? 0),
      namedGroups: namedGroupsRes.rows,
      defaultGroupName: (defaultGroupNameRes.rows[0]?.default_group_name as string | null) ?? null,
      inDefaultGroup: canSeeDefaultGroup,
      messages,
    });
  } catch (error) {
    console.error("[chat/bootstrap GET]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
