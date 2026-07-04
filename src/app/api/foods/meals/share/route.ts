import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { resolveCoachId } from "@/lib/chat-group";
import { sendSecurityAlert } from "@/lib/security-alerts";
import { pushToUsers, setupVapid } from "@/lib/chat-push";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (user.role !== "client") return NextResponse.json({ error: "לקוחות בלבד" }, { status: 403 });

  try {
    await initDb();

    const body = await req.json();
    const mealId = typeof body.mealId === "string" ? body.mealId : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

    if (!mealId) return NextResponse.json({ error: "חסר mealId" }, { status: 400 });
    if (!imageUrl) return NextResponse.json({ error: "חסר imageUrl" }, { status: 400 });

    const mealRes = await db.execute({
      sql: `SELECT id, user_id, total_calories
            FROM ai_meal_logs
            WHERE id = ?`,
      args: [mealId],
    });

    const meal = mealRes.rows[0] as unknown as { id: string; user_id: string; total_calories: number | null } | undefined;
    if (!meal) return NextResponse.json({ error: "הארוחה לא נמצאה" }, { status: 404 });
    if (meal.user_id !== user.id) {
      return NextResponse.json({ error: "אין הרשאה לשתף את הארוחה הזאת" }, { status: 403 });
    }

    const coachId = resolveCoachId(user);
    if (!coachId) {
      return NextResponse.json({ error: "המשתמש אינו משויך לקבוצה" }, { status: 403 });
    }

    const coachCheckRes = await db.execute({
      sql: `SELECT id FROM users WHERE id = ? AND role = 'coach'`,
      args: [coachId],
    });
    if (!coachCheckRes.rows[0]) {
      await sendSecurityAlert({
        event: "meal_share_cross_group_attempt",
        severity: "high",
        ip: req.headers.get("x-forwarded-for"),
        identifier: user.id,
        details: `resolved invalid coach ${coachId} for meal ${mealId}`,
        cooldownMs: 30 * 60 * 1000,
      });
      return NextResponse.json({ error: "אין הרשאה לשתף לקבוצה הזאת" }, { status: 403 });
    }

    const caption = `${user.name} שיתף/ה ארוחה - ${Math.round(Number(meal.total_calories) || 0)} קל'`;
    const messageId = uuid();

    await db.execute({
      sql: `INSERT INTO chat_messages (id, sender_id, receiver_id, content, image_url, sent_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [messageId, user.id, null, caption, imageUrl],
    });

    try {
      setupVapid();
      const membersRes = await db.execute({
        sql: `SELECT id FROM users WHERE id = ? OR coach_id = ?`,
        args: [coachId, coachId],
      });
      const memberIds = (membersRes.rows as unknown as { id: string }[]).map((row) => row.id).filter((id) => id !== user.id);
      const payload = JSON.stringify({
        title: `📸 ${user.name}`,
        body: caption,
        icon: "/icon-192.png",
      });
      await pushToUsers(memberIds, payload);
    } catch (pushError) {
      console.error("[foods/meals/share push]", pushError);
    }

    return NextResponse.json({ id: messageId });
  } catch (error) {
    console.error("[foods/meals/share POST]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
