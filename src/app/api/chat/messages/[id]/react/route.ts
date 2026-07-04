import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { isGroupMember, resolveCoachId } from "@/lib/chat-group";
import { sendSecurityAlert } from "@/lib/security-alerts";

const ALLOWED_EMOJIS = ["👍", "❤️", "🔥", "😂", "😢"] as const;

type MessageContext = {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  group_id: string | null;
};

async function getReactionAggregate(messageId: string, userId: string) {
  const result = await db.execute({
    sql: `SELECT emoji, COUNT(*) AS count,
                 MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS reacted_by_me
          FROM chat_message_reactions
          WHERE message_id = ?
          GROUP BY emoji
          ORDER BY MIN(created_at) ASC`,
    args: [userId, messageId],
  });
  return result.rows.map((row) => ({
    emoji: String(row.emoji),
    count: Number(row.count),
    reactedByMe: Number(row.reacted_by_me) === 1,
  }));
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  try {
    await initDb();
    const { id: messageId } = await context.params;
    const body = await req.json() as { emoji?: unknown };
    if (typeof body.emoji !== "string" || !ALLOWED_EMOJIS.includes(body.emoji as typeof ALLOWED_EMOJIS[number])) {
      return NextResponse.json({ error: "תגובה לא תקינה" }, { status: 400 });
    }

    const messageResult = await db.execute({
      sql: "SELECT id, sender_id, receiver_id, group_id FROM chat_messages WHERE id = ?",
      args: [messageId],
    });
    const message = messageResult.rows[0] as unknown as MessageContext | undefined;
    if (!message) return NextResponse.json({ error: "ההודעה לא נמצאה" }, { status: 404 });

    let allowed = false;
    if (message.group_id !== null) {
      allowed = await isGroupMember(message.group_id, user.id);
    } else if (message.receiver_id !== null) {
      allowed = user.id === message.sender_id || user.id === message.receiver_id;
    } else {
      const senderResult = await db.execute({
        sql: "SELECT id, role, coach_id FROM users WHERE id = ?",
        args: [message.sender_id],
      });
      const sender = senderResult.rows[0] as unknown as { id: string; role: string; coach_id: string | null } | undefined;
      const senderCoachId = sender ? resolveCoachId(sender) : null;
      const requesterCoachId = resolveCoachId(user as Parameters<typeof resolveCoachId>[0]);
      allowed = senderCoachId !== null && senderCoachId === requesterCoachId;
    }

    if (!allowed) {
      await sendSecurityAlert({
        event: "chat_reaction_access_violation",
        severity: "high",
        ip: req.headers.get("x-forwarded-for"),
        identifier: user.id,
        details: `tried to react to message ${messageId}`,
        cooldownMs: 30 * 60 * 1000,
      });
      return NextResponse.json({ error: "אין הרשאה להגיב להודעה זו" }, { status: 403 });
    }

    const existing = await db.execute({
      sql: "SELECT emoji FROM chat_message_reactions WHERE message_id = ? AND user_id = ?",
      args: [messageId, user.id],
    });
    if (existing.rows[0]?.emoji === body.emoji) {
      await db.execute({
        sql: "DELETE FROM chat_message_reactions WHERE message_id = ? AND user_id = ?",
        args: [messageId, user.id],
      });
    } else {
      await db.execute({
        sql: `INSERT OR REPLACE INTO chat_message_reactions (message_id, user_id, emoji, created_at)
              VALUES (?, ?, ?, datetime('now'))`,
        args: [messageId, user.id, body.emoji],
      });
    }

    return NextResponse.json({ reactions: await getReactionAggregate(messageId, user.id) });
  } catch (error) {
    console.error("[chat/messages/react POST]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
