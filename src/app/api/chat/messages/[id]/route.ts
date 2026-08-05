import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { isGroupOwner } from "@/lib/chat-group";
import { sendSecurityAlert } from "@/lib/security-alerts";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  try {
    await initDb();
    const { id: messageId } = await context.params;

    const messageRes = await db.execute({
      sql: "SELECT id, sender_id, receiver_id, group_id FROM chat_messages WHERE id = ?",
      args: [messageId],
    });
    const message = messageRes.rows[0] as unknown as
      | { id: string; sender_id: string; receiver_id: string | null; group_id: string | null }
      | undefined;
    if (!message) return NextResponse.json({ error: "ההודעה לא נמצאה" }, { status: 404 });

    let allowed = message.sender_id === user.id;

    if (!allowed && user.role === "coach" && message.receiver_id === null) {
      if (message.group_id !== null) {
        allowed = await isGroupOwner(message.group_id, user.id);
      } else {
        const ownerCheck = await db.execute({
          sql: `SELECT 1 FROM users WHERE id = ? AND (id = ? OR coach_id = ?) LIMIT 1`,
          args: [message.sender_id, user.id, user.id],
        });
        allowed = Boolean(ownerCheck.rows[0]);
      }
    }

    if (!allowed) {
      await sendSecurityAlert({
        event: "chat_delete_ownership_violation",
        severity: "high",
        ip: req.headers.get("x-forwarded-for"),
        identifier: user.id,
        details: `tried to delete message ${messageId}`,
        cooldownMs: 30 * 60 * 1000,
      });
      return NextResponse.json({ error: "אין הרשאה למחוק הודעה זו" }, { status: 403 });
    }

    await db.execute({ sql: "DELETE FROM chat_messages WHERE id = ?", args: [messageId] });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[chat/messages/[id] DELETE]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
