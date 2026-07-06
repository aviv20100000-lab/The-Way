import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { sendSecurityAlert } from "@/lib/security-alerts";

async function alertViolation(req: NextRequest, userId: string, details: string) {
  await sendSecurityAlert({
    event: "chat_group_management_violation",
    severity: "high",
    ip: req.headers.get("x-forwarded-for"),
    identifier: userId,
    details,
    cooldownMs: 30 * 60 * 1000,
  });
}

async function validateRequest(req: NextRequest, groupId: string) {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "לא מחובר" }, { status: 401 }) };
  await initDb();
  if (user.role !== "coach") {
    await alertViolation(req, user.id, `non-coach tried to edit members of chat group ${groupId}`);
    return { response: NextResponse.json({ error: "למאמנים בלבד" }, { status: 403 }) };
  }

  const group = await db.execute({
    sql: "SELECT id FROM chat_groups WHERE id = ? AND coach_id = ?",
    args: [groupId, user.id],
  });
  if (group.rows.length === 0) {
    return { response: NextResponse.json({ error: "הקבוצה לא נמצאה" }, { status: 404 }) };
  }

  const body = await req.json() as { clientId?: unknown };
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  if (!clientId) {
    return { response: NextResponse.json({ error: "חסר מזהה מתאמן" }, { status: 400 }) };
  }

  const client = await db.execute({
    sql: "SELECT id FROM users WHERE id = ? AND coach_id = ? AND role = 'client'",
    args: [clientId, user.id],
  });
  if (client.rows.length === 0) {
    await alertViolation(req, user.id, `tried to edit chat group ${groupId} with unauthorized client ${clientId}`);
    return { response: NextResponse.json({ error: "המתאמן אינו שייך למאמן" }, { status: 400 }) };
  }

  return { user, clientId };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params;
    const validation = await validateRequest(req, groupId);
    if ("response" in validation) return validation.response;
    await db.execute({
      sql: "INSERT OR IGNORE INTO chat_group_members (group_id, user_id) VALUES (?, ?)",
      args: [groupId, validation.clientId],
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[coach/chat-groups/members POST]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params;
    const validation = await validateRequest(req, groupId);
    if ("response" in validation) return validation.response;
    await db.execute({
      sql: "DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?",
      args: [groupId, validation.clientId],
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[coach/chat-groups/members DELETE]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
