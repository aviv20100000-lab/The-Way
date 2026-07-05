import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import db, { initDb } from "@/lib/db";
import { sendSecurityAlert } from "@/lib/security-alerts";
import { pushToUsers, setupVapid } from "@/lib/chat-push";
import { isGroupMember, isInDefaultGroup, resolveCoachId } from "@/lib/chat-group";
import { attachChatReactions } from "@/lib/chat-reactions";

type MessageRow = { id: string } & Record<string, unknown>;

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
              ORDER BY m.sent_at ASC
              LIMIT 100`,
        args: [groupId],
      });

      await db.execute({
        sql: `UPDATE chat_messages SET is_read = 1
              WHERE group_id = ? AND sender_id != ? AND is_read = 0`,
        args: [groupId, user.id],
      });
      const messages = await attachChatReactions(result.rows as unknown as MessageRow[], user.id);
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

      const peerCoachId = peer.role === "coach" ? peer.id : peer.coach_id;
      if (peerCoachId !== coachId) {
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
              ORDER BY m.sent_at ASC
              LIMIT 100`,
        args: [user.id, withUserId, withUserId, user.id],
      });

      await db.execute({
        sql: `UPDATE chat_messages SET is_read = 1
              WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
        args: [withUserId, user.id],
      });

      const messages = await attachChatReactions(result.rows as unknown as MessageRow[], user.id);
      return NextResponse.json({ messages });
    }

    const coachId = resolveCoachId(user as Parameters<typeof resolveCoachId>[0]);
    if (!coachId) return NextResponse.json({ messages: [] });

    if (!(await isInDefaultGroup(user))) {
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
            ORDER BY m.sent_at ASC
            LIMIT 100`,
      args: [coachId, coachId],
    });

    await db.execute({
      sql: `UPDATE chat_messages SET is_read = 1
            WHERE receiver_id IS NULL
              AND group_id IS NULL
              AND sender_id != ?
              AND (sender_id = ? OR sender_id IN (SELECT id FROM users WHERE coach_id = ?))
              AND is_read = 0`,
      args: [user.id, coachId, coachId],
    });

    const messages = await attachChatReactions(result.rows as unknown as MessageRow[], user.id);
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

    if (!hasReceiver && !hasGroup && !(await isInDefaultGroup(user))) {
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

      const receiverCoachId = receiver.role === "coach" ? receiver.id : receiver.coach_id;
      if (receiverCoachId !== coachId) {
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

    try {
      setupVapid();
      const senderName = (user as { name?: string }).name ?? "מישהו";
      const preview = content.trim().slice(0, 80);
      const payload = JSON.stringify({ title: `💬 ${senderName}`, body: preview, icon: "/icon-192.png" });

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
          .filter((memberId) => memberId !== user.id);
        await pushToUsers(memberIds, payload);
      } else {
        const membersRes = await db.execute({
          sql: `SELECT id FROM users WHERE id = ? OR (coach_id = ? AND in_default_group = 1)`,
          args: [coachId, coachId],
        });
        const memberIds = (membersRes.rows as unknown as { id: string }[])
          .map((row) => row.id)
          .filter((memberId) => memberId !== user.id);
        await pushToUsers(memberIds, payload);
      }
    } catch (pushErr) {
      console.error("[chat/messages push]", pushErr);
    }

    return NextResponse.json({ id });
  } catch (err) {
    console.error("[chat/messages POST]", err);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
