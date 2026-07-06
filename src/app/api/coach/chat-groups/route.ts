import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { sendSecurityAlert } from "@/lib/security-alerts";

type GroupRow = {
  id: string;
  name: string;
  member_count: number;
  member_names: string | null;
  member_ids: string | null;
};

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

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  await initDb();
  if (user.role !== "coach") {
    await alertViolation(req, user.id, "non-coach tried to list coach chat groups");
    return NextResponse.json({ error: "למאמנים בלבד" }, { status: 403 });
  }
  const result = await db.execute({
    sql: `SELECT g.id, g.name,
                 COUNT(gm.user_id) AS member_count,
                 GROUP_CONCAT(u.name, '||') AS member_names,
                 GROUP_CONCAT(u.id, '||') AS member_ids
          FROM chat_groups g
          LEFT JOIN chat_group_members gm ON gm.group_id = g.id
          LEFT JOIN users u ON u.id = gm.user_id
          WHERE g.coach_id = ?
          GROUP BY g.id, g.name, g.created_at
          ORDER BY g.created_at DESC`,
    args: [user.id],
  });
  const groups = (result.rows as unknown as GroupRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    memberCount: Number(row.member_count),
    memberNames: row.member_names ? row.member_names.split("||") : [],
    memberIds: row.member_ids ? row.member_ids.split("||") : [],
  }));
  return NextResponse.json({ groups });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  await initDb();
  if (user.role !== "coach") {
    await alertViolation(req, user.id, "non-coach tried to create a chat group");
    return NextResponse.json({ error: "למאמנים בלבד" }, { status: 403 });
  }

  try {
    const body = await req.json() as { name?: unknown; memberIds?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 60) {
      return NextResponse.json({ error: "שם הקבוצה חייב להכיל 1–60 תווים" }, { status: 400 });
    }
    if (!Array.isArray(body.memberIds) || body.memberIds.some((id) => typeof id !== "string")) {
      return NextResponse.json({ error: "רשימת המתאמנים אינה תקינה" }, { status: 400 });
    }

    const memberIds = [...new Set(body.memberIds as string[])];
    if (memberIds.length > 0) {
      const placeholders = memberIds.map(() => "?").join(",");
      const members = await db.execute({
        sql: `SELECT id FROM users
              WHERE coach_id = ? AND role = 'client' AND id IN (${placeholders})`,
        args: [user.id, ...memberIds],
      });
      if (members.rows.length !== memberIds.length) {
        await alertViolation(req, user.id, `tried to add unauthorized users to a chat group: ${memberIds.join(",")}`);
        return NextResponse.json({ error: "אחד או יותר מהמתאמנים אינם שייכים למאמן" }, { status: 400 });
      }
    }

    const id = uuid();
    await db.batch([
      { sql: "INSERT INTO chat_groups (id, coach_id, name) VALUES (?, ?, ?)", args: [id, user.id, name] },
      ...memberIds.map((memberId) => ({
        sql: "INSERT INTO chat_group_members (group_id, user_id) VALUES (?, ?)",
        args: [id, memberId],
      })),
    ], "write");

    return NextResponse.json({ id, name });
  } catch (error) {
    console.error("[coach/chat-groups POST]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
