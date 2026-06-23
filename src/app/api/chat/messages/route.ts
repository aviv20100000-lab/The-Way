import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import db, { initDb } from "@/lib/db";

function resolveCoachId(user: { id: string; role: string; coach_id?: string }): string | null {
  return user.role === "coach" ? user.id : (user.coach_id ?? null);
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

    if (type === "private") {
      if (!withUserId) return NextResponse.json({ error: "חסר פרמטר with" }, { status: 400 });

      // Verify withUserId is in the same group before fetching
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
        return NextResponse.json({ error: "אין הרשאה לצפות בשיחה זו" }, { status: 403 });
      }

      const result = await db.execute({
        sql: `SELECT m.id, m.content, m.sent_at, m.is_read,
                     m.sender_id, u.name as sender_name
              FROM chat_messages m
              JOIN users u ON u.id = m.sender_id
              WHERE ((m.sender_id = ? AND m.receiver_id = ?)
                 OR  (m.sender_id = ? AND m.receiver_id = ?))
              ORDER BY m.sent_at ASC
              LIMIT 100`,
        args: [user.id, withUserId, withUserId, user.id],
      });

      // Mark incoming messages as read
      await db.execute({
        sql: `UPDATE chat_messages SET is_read = 1
              WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
        args: [withUserId, user.id],
      });

      return NextResponse.json({ messages: result.rows });
    }

    // Group chat
    const coachId = resolveCoachId(user as Parameters<typeof resolveCoachId>[0]);
    if (!coachId) return NextResponse.json({ messages: [] });

    const result = await db.execute({
      sql: `SELECT m.id, m.content, m.sent_at, m.is_read,
                   m.sender_id, u.name as sender_name
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
    });

    // Mark group messages from others as read for this user.
    // is_read is a shared flag — acceptable for this use case (small groups).
    await db.execute({
      sql: `UPDATE chat_messages SET is_read = 1
            WHERE receiver_id IS NULL
              AND sender_id != ?
              AND (sender_id = ? OR sender_id IN (SELECT id FROM users WHERE coach_id = ?))
              AND is_read = 0`,
      args: [user.id, coachId, coachId],
    });

    return NextResponse.json({ messages: result.rows });
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
    const { content, receiver_id } = body as { content: unknown; receiver_id?: unknown };

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "הודעה ריקה" }, { status: 400 });
    }
    if (content.length > 1000) {
      return NextResponse.json({ error: "הודעה ארוכה מדי (מקסימום 1000 תווים)" }, { status: 400 });
    }

    const coachId = resolveCoachId(user as Parameters<typeof resolveCoachId>[0]);
    if (!coachId) {
      return NextResponse.json({ error: "המשתמש אינו משויך לקבוצה" }, { status: 403 });
    }

    if (receiver_id !== undefined && receiver_id !== null) {
      // Private message — verify receiver is in the same group
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
        return NextResponse.json({ error: "אין הרשאה לשלוח הודעה למשתמש זה" }, { status: 403 });
      }
    }

    const id = uuid();
    await db.execute({
      sql: `INSERT INTO chat_messages (id, sender_id, receiver_id, content, sent_at)
            VALUES (?, ?, ?, ?, datetime('now'))`,
      args: [id, user.id, (receiver_id as string) ?? null, content.trim()],
    });

    return NextResponse.json({ id });
  } catch (err) {
    console.error("[chat/messages POST]", err);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
