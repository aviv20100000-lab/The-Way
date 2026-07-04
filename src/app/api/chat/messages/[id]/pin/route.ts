import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { isGroupOwner } from "@/lib/chat-group";
import { sendSecurityAlert } from "@/lib/security-alerts";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  try {
    await initDb();
    const { id: messageId } = await context.params;
    const body = await req.json();
    const pinned = body?.pinned === true;

    if (user.role !== "coach") {
      return NextResponse.json({ error: "רק מאמנים יכולים לנעוץ הודעות" }, { status: 403 });
    }

    const messageRes = await db.execute({
      sql: "SELECT id, sender_id, receiver_id, group_id FROM chat_messages WHERE id = ?",
      args: [messageId],
    });
    const message = messageRes.rows[0] as unknown as
      | { id: string; sender_id: string; receiver_id: string | null; group_id: string | null }
      | undefined;
    if (!message) return NextResponse.json({ error: "ההודעה לא נמצאה" }, { status: 404 });
    if (message.receiver_id !== null) {
      return NextResponse.json({ error: "לא ניתן לנעוץ הודעה פרטית" }, { status: 400 });
    }

    if (message.group_id !== null) {
      if (!(await isGroupOwner(message.group_id, user.id))) {
        await sendSecurityAlert({
          event: "chat_pin_ownership_violation",
          severity: "high",
          ip: req.headers.get("x-forwarded-for"),
          identifier: user.id,
          details: `tried to pin message ${messageId} in group ${message.group_id}`,
          cooldownMs: 30 * 60 * 1000,
        });
        return NextResponse.json({ error: "אין הרשאה לנעוץ הודעה בקבוצה זו" }, { status: 403 });
      }
    } else {
      // Default all-clients group: the message must belong to THIS coach's own group.
      const ownerCheck = await db.execute({
        sql: `SELECT 1 FROM users WHERE id = ? AND (id = ? OR coach_id = ?) LIMIT 1`,
        args: [message.sender_id, user.id, user.id],
      });
      if (!ownerCheck.rows[0]) {
        await sendSecurityAlert({
          event: "chat_pin_ownership_violation",
          severity: "high",
          ip: req.headers.get("x-forwarded-for"),
          identifier: user.id,
          details: `tried to pin message ${messageId} in default group not owned by this coach`,
          cooldownMs: 30 * 60 * 1000,
        });
        return NextResponse.json({ error: "אין הרשאה לנעוץ הודעה זו" }, { status: 403 });
      }
    }

    if (pinned) {
      // Only one pinned message per group scope — unpin any previous one first.
      if (message.group_id !== null) {
        await db.execute({
          sql: "UPDATE chat_messages SET pinned = 0 WHERE group_id = ? AND pinned = 1",
          args: [message.group_id],
        });
      } else {
        await db.execute({
          sql: `UPDATE chat_messages SET pinned = 0
                WHERE group_id IS NULL AND receiver_id IS NULL AND pinned = 1
                  AND (sender_id = ? OR sender_id IN (SELECT id FROM users WHERE coach_id = ?))`,
          args: [user.id, user.id],
        });
      }
    }

    await db.execute({
      sql: "UPDATE chat_messages SET pinned = ? WHERE id = ?",
      args: [pinned ? 1 : 0, messageId],
    });

    return NextResponse.json({ ok: true, pinned });
  } catch (error) {
    console.error("[chat/messages/pin POST]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
