import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import {
  buildFeedbackMemoryNote,
  isAssistantFeedbackAction,
  parseMemoryList,
  parsePreferenceProfile,
  updateMemoryList,
  updatePreferenceProfile,
} from "@/lib/assistant-learning";

type PreferenceRow = {
  liked_notes?: string | null;
  disliked_notes?: string | null;
  saved_notes?: string | null;
  profile_json?: string | null;
  feedback_count?: number | null;
};

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (session.role !== "client") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  let body: { messageId?: unknown; action?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 160) : "";
  if (!messageId || !isAssistantFeedbackAction(body.action)) {
    return NextResponse.json({ error: "פידבק לא תקין" }, { status: 400 });
  }
  const action = body.action;

  await initDb();

  const messageRes = await db.execute({
    sql: "SELECT content FROM assistant_messages WHERE id = ? AND user_id = ? AND role = 'assistant'",
    args: [messageId, session.id],
  });
  const messageContent = String(messageRes.rows[0]?.content ?? "");
  if (!messageContent) return NextResponse.json({ error: "הודעה לא נמצאה" }, { status: 404 });

  const prefRes = await db.execute({
    sql: "SELECT liked_notes, disliked_notes, saved_notes, profile_json, feedback_count FROM assistant_preferences WHERE user_id = ?",
    args: [session.id],
  });
  const current = prefRes.rows[0] as PreferenceRow | undefined;
  const memoryNote = buildFeedbackMemoryNote(messageContent, note);
  let likedNotes = parseMemoryList(current?.liked_notes);
  let dislikedNotes = parseMemoryList(current?.disliked_notes);
  let savedNotes = parseMemoryList(current?.saved_notes);
  const profile = updatePreferenceProfile(parsePreferenceProfile(current?.profile_json), action, messageContent, note);

  if (action === "liked") likedNotes = updateMemoryList(likedNotes, memoryNote);
  if (action === "disliked") dislikedNotes = updateMemoryList(dislikedNotes, memoryNote);
  if (action === "saved") savedNotes = updateMemoryList(savedNotes, memoryNote);

  await db.batch([
    {
      sql: "INSERT INTO assistant_feedback (id, user_id, message_id, action, note) VALUES (?, ?, ?, ?, ?)",
      args: [randomUUID(), session.id, messageId, action, note || null],
    },
    {
      sql: `INSERT INTO assistant_preferences
              (user_id, liked_notes, disliked_notes, saved_notes, profile_json, feedback_count, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
            ON CONFLICT(user_id) DO UPDATE SET
              liked_notes = excluded.liked_notes,
              disliked_notes = excluded.disliked_notes,
              saved_notes = excluded.saved_notes,
              profile_json = excluded.profile_json,
              feedback_count = assistant_preferences.feedback_count + 1,
              updated_at = datetime('now')`,
      args: [session.id, JSON.stringify(likedNotes), JSON.stringify(dislikedNotes), JSON.stringify(savedNotes), JSON.stringify(profile)],
    },
  ]);

  return NextResponse.json({ ok: true });
}
