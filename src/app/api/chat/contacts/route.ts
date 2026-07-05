import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { isInDefaultGroup } from "@/lib/chat-group";

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

    let contacts: { id: string; name: string; role: string; username: string; avatar_url: string | null }[] = [];
    if (coachId) {
      const membersRes = await db.execute({
        sql: `SELECT id, name, role, username, avatar_url FROM users
              WHERE (id = ? OR coach_id = ?) AND id != ?
              ORDER BY role DESC, name ASC`,
        args: [coachId, coachId, user.id],
      });
      contacts = membersRes.rows as unknown as { id: string; name: string; role: string; username: string; avatar_url: string | null }[];
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
    const inDefaultGroup = coachId ? await isInDefaultGroup(user) : false;
    let groupUnread = 0;
    if (coachId && inDefaultGroup) {
      const groupUnreadRes = await db.execute({
        sql: `SELECT COUNT(*) as count FROM chat_messages
              WHERE receiver_id IS NULL
                AND group_id IS NULL
                AND sender_id != ?
                AND (sender_id = ? OR sender_id IN (SELECT id FROM users WHERE coach_id = ?))
                AND is_read = 0`,
        args: [user.id, coachId, coachId],
      });
      groupUnread = Number(groupUnreadRes.rows[0]?.count ?? 0);
    }

    const namedGroupsRes = user.role === "coach"
      ? await db.execute({
          sql: "SELECT id, name, image_url AS imageUrl FROM chat_groups WHERE coach_id = ? ORDER BY created_at DESC",
          args: [user.id],
        })
      : await db.execute({
          sql: `SELECT g.id, g.name, g.image_url AS imageUrl
                FROM chat_groups g
                JOIN chat_group_members gm ON gm.group_id = g.id
                WHERE gm.user_id = ?
                ORDER BY g.created_at DESC`,
          args: [user.id],
        });

    const defaultGroupNameRes = coachId
      ? await db.execute({ sql: "SELECT default_group_name FROM users WHERE id = ?", args: [coachId] })
      : { rows: [] as { default_group_name?: string | null }[] };
    const defaultGroupName = (defaultGroupNameRes.rows[0]?.default_group_name as string | null | undefined) ?? null;

    return NextResponse.json({ contacts, unreadMap, groupUnread, namedGroups: namedGroupsRes.rows, defaultGroupName, inDefaultGroup, coachId });
  } catch (err) {
    console.error("[chat/contacts GET]", err);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
