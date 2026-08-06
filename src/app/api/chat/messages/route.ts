import { after, NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import db, { initDb } from "@/lib/db";
import { sendSecurityAlert } from "@/lib/security-alerts";
import { pushToUsers, setupVapid } from "@/lib/chat-push";
import { canAccessDefaultGroup, canAccessPrivateChat, getDefaultGroupMemberIds, isGroupMember, resolveCoachId } from "@/lib/chat-group";
import { attachChatReactions } from "@/lib/chat-reactions";
import { defaultGroupReadKey, markGroupRead, namedGroupReadKey } from "@/lib/chat-reads";
import { toAvatarProxyUrl } from "@/lib/avatar-url";

type MessageRow = { id: string } & Record<string, unknown>;

function chronologicalRows(rows: Iterable<unknown>, incremental: boolean): MessageRow[] {
  const ordered = Array.from(rows) as MessageRow[];
  return incremental ? ordered : ordered.reverse();
}

function withAvatarProxy<T extends Record<string, unknown>>(messages: T[]): T[] {
  return messages.map((message) => ({
    ...message,
    sender_avatar_url: toAvatarProxyUrl(String(message.sender_id), message.sender_avatar_url as string | null),
  }));
}

// GET /api/chat/messages?type=group|private&with=userId
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  try {
    await initDb();

    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type") ?? "group";
    const withUserId = searchParams.get("with");
    const groupId = searchParams.get("groupId");
    const rawAfterId = searchParams.get("afterId")?.trim() ?? "";
    if (rawAfterId.length > 100) {
      return NextResponse.json({ error: "afterId לא תקין" }, { status: 400 });
    }
    const afterId = rawAfterId || null;
    const cursorSql = afterId
      ? "AND m.rowid > COALESCE((SELECT rowid FROM chat_messages WHERE id = ?), 0)"
      : "";
    const orderSql = afterId ? "ORDER BY m.rowid ASC" : "ORDER BY m.sent_at DESC";

    if (type === "namedGroup") {
      if (!groupId) return NextResponse.json({ error: "חסר groupId" }, { status: 400 });
      if (!(await isGroupMember(groupId, user.id))) {
        await sendSecurityAlert({
          event: "chat_named_group_read_attempt",
          severity: "high",
          ip: req.headers.get("x-forwarded-for"),
          identifier: user.id,
          details: `tried to read named group ${groupId}`,
          cooldownMs: 30 * 60 * 1000,
        });
        return NextResponse.json({ error: "אין הרשאה לצפות בקבוצה זו" }, { status: 403 });
      }

      const result = await db.execute({
        sql: `SELECT m.id, m.content, m.image_url, m.is_read, m.pinned,
                     m.sender_id, u.name as sender_name, u.username as sender_username,
                     u.avatar_url as sender_avatar_url,
                     strftime('%Y-%m-%dT%H:%M:%SZ', m.sent_at) as sent_at
              FROM chat_messages m
              JOIN users u ON u.id = m.sender_id
              WHERE m.group_id = ?
              ${cursorSql}
              ${orderSql}
              LIMIT 100`,
        args: [groupId, ...(afterId ? [afterId] : [])],
      });

      await markGroupRead(user.id, namedGroupReadKey(groupId));
      const recentRows = chronologicalRows(result.rows, Boolean(afterId));
      const messages = withAvatarProxy(await attachChatReactions(recentRows, user.id));
      return NextResponse.json({ messages });
    }

    if (type === "private") {
      if (!withUserId) return NextResponse.json({ error: "חסר פרמטר with" }, { status: 400 });

      const coachId = resolveCoachId(user as Parameters<typeof resolveCoachId>[0]);
      if (!coachId) return NextResponse.json({ error: "המשתמש אינו משויך לקבוצה" }, { status: 403 });

      const peerRes = await db.execute({
        sql: `SELECT id, role, coach_id FROM users WHERE id = ?`,
        args: [withUserId],
      });
      const peer = peerRes.rows[0] as unknown as { id: string; role: string; coach_id: string | null } | undefined;
      if (!peer) return NextResponse.json({ error: "משתמש לא קיים" }, { status: 404 });

      if (!(await canAccessPrivateChat(user as Parameters<typeof canAccessPrivateChat>[0], peer))) {
        await sendSecurityAlert({
          event: "chat_cross_group_read_attempt",
          severity: "medium",
          ip: req.headers.get("x-forwarded-for"),
          identifier: user.id,
          details: `tried to read messages with ${withUserId}`,
          cooldownMs: 30 * 60 * 1000,
        });
        return NextResponse.json({ error: "אין הרשאה לצפות בשיחה זו" }, { status: 403 });
      }

      const result = await db.execute({
        sql: `SELECT m.id, m.content, m.image_url, m.is_read,
                     m.sender_id, u.name as sender_name, u.username as sender_username,
                     u.avatar_url as sender_avatar_url,
                     strftime('%Y-%m-%dT%H:%M:%SZ', m.sent_at) as sent_at
              FROM chat_messages m
              JOIN users u ON u.id = m.sender_id
              WHERE ((m.sender_id = ? AND m.receiver_id = ?)
                 OR  (m.sender_id = ? AND m.receiver_id = ?))
              ${cursorSql}
              ${orderSql}
              LIMIT 100`,
        args: [user.id, withUserId, withUserId, user.id, ...(afterId ? [afterId] : [])],
      });

      await db.execute({
        sql: `UPDATE chat_messages SET is_read = 1
              WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
        args: [withUserId, user.id],
      });

      const recentRows = chronologicalRows(result.rows, Boolean(afterId));
      const messages = withAvatarProxy(await attachChatReactions(recentRows, user.id));
      return NextResponse.json({ messages });
    }

    const coachId = resolveCoachId(user as Parameters<typeof resolveCoachId>[0]);
    if (!coachId) return NextResponse.json({ messages: [] });

    if (!(await canAccessDefaultGroup(user))) {
      return NextResponse.json({ error: "אינך חבר בקבוצה" }, { status: 403 });
    }

    const result = await db.execute({
      sql: `SELECT m.id, m.content, m.image_url, m.is_read, m.pinned,
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
            ${cursorSql}
            ${orderSql}
            LIMIT 100`,
      args: [coachId, coachId, ...(afterId ? [afterId] : [])],
    });

    await markGroupRead(user.id, defaultGroupReadKey(coachId));

    const recentRows = chronologicalRows(result.rows, Boolean(afterId));
    const messages = withAvatarProxy(await attachChatReactions(recentRows, user.id));
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[chat/messages GET]", err);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}

// POST /api/chat/messages
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  try {
    await initDb();

    const body = await req.json();
    const { content, receiver_id, group_id } = body as {
      content: unknown;
      receiver_id?: unknown;
      group_id?: unknown;
    };

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "הודעה ריקה" }, { status: 400 });
    }
    if (content.length > 1000) {
      return NextResponse.json({ error: "הודעה ארוכה מדי (מקסימום 1000 תווים)" }, { status: 400 });
    }

    const hasReceiver = receiver_id !== undefined && receiver_id !== null;
    const hasGroup = group_id !== undefined && group_id !== null;
    if (hasReceiver && hasGroup) {
      return NextResponse.json({ error: "לא ניתן לשלוח לקבוצה ולנמען פרטי יחד" }, { status: 400 });
    }
    if (hasGroup && (typeof group_id !== "string" || !group_id.trim())) {
      return NextResponse.json({ error: "group_id לא תקין" }, { status: 400 });
    }

    const coachId = resolveCoachId(user as Parameters<typeof resolveCoachId>[0]);
    if (!coachId) {
      return NextResponse.json({ error: "המשתמש אינו משויך לקבוצה" }, { status: 403 });
    }

    if (!hasReceiver && !hasGroup && !(await canAccessDefaultGroup(user))) {
      return NextResponse.json({ error: "אינך חבר בקבוצה" }, { status: 403 });
    }

    if (hasGroup && typeof group_id === "string" && !(await isGroupMember(group_id, user.id))) {
      await sendSecurityAlert({
        event: "chat_named_group_write_attempt",
        severity: "high",
        ip: req.headers.get("x-forwarded-for"),
        identifier: user.id,
        details: `tried to send message to named group ${group_id}`,
        cooldownMs: 30 * 60 * 1000,
      });
      return NextResponse.json({ error: "אין הרשאה לשלוח הודעה לקבוצה זו" }, { status: 403 });
    }

    if (hasReceiver) {
      if (typeof receiver_id !== "string") {
        return NextResponse.json({ error: "receiver_id לא תקין" }, { status: 400 });
      }
      const receiverRes = await db.execute({
        sql: `SELECT id, coach_id, role FROM users WHERE id = ?`,
        args: [receiver_id],
      });
      const receiver = receiverRes.rows[0] as unknown as { id: string; role: string; coach_id: string | null } | undefined;
      if (!receiver) return NextResponse.json({ error: "משתמש לא קיים" }, { status: 404 });

      if (!(await canAccessPrivateChat(user as Parameters<typeof canAccessPrivateChat>[0], receiver))) {
        await sendSecurityAlert({
          event: "chat_cross_group_write_attempt",
          severity: "high",
          ip: req.headers.get("x-forwarded-for"),
          identifier: user.id,
          details: `tried to send message to ${receiver_id}`,
          cooldownMs: 30 * 60 * 1000,
        });
        return NextResponse.json({ error: "אין הרשאה לשלוח הודעה למשתמש זה" }, { status: 403 });
      }
    }

    const id = uuid();
    await db.execute({
      sql: `INSERT INTO chat_messages (id, sender_id, receiver_id, group_id, content, sent_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [id, user.id, hasReceiver ? receiver_id as string : null, hasGroup ? group_id as string : null, content.trim()],
    });

    const senderId = user.id;
    const senderName = (user as { name?: string }).name ?? "מישהו";
    const preview = content.trim().slice(0, 80);
    const payload = JSON.stringify({ title: `💬 ${senderName}`, body: preview, icon: "/icon-192.png", url: "/chat" });

    after(async () => {
      try {
        setupVapid();

        if (hasReceiver && typeof receiver_id === "string") {
          await pushToUsers([receiver_id], payload);
        } else if (hasGroup && typeof group_id === "string") {
          const membersRes = await db.execute({
            sql: `SELECT coach_id AS id FROM chat_groups WHERE id = ?
                  UNION
                  SELECT user_id AS id FROM chat_group_members WHERE group_id = ?`,
            args: [group_id, group_id],
          });
          const memberIds = (membersRes.rows as unknown as { id: string }[])
            .map((row) => row.id)
            .filter((memberId) => memberId !== senderId);
          await pushToUsers(memberIds, payload);
        } else {
          const memberIds = (await getDefaultGroupMemberIds(coachId)).filter((memberId) => memberId !== senderId);
          await pushToUsers(memberIds, payload);
        }
      } catch (pushErr) {
        console.error("[chat/messages push]", pushErr);
      }
    });

    return NextResponse.json({ id });
  } catch (err) {
    console.error("[chat/messages POST]", err);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
