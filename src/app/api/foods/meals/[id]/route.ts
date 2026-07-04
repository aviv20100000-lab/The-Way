import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const { id } = await params;

  // Try ai_meal_logs first
  const aiRes = await db.execute({ sql: "SELECT id FROM ai_meal_logs WHERE id = ? AND user_id = ?", args: [id, user.id] });
  if (aiRes.rows.length > 0) {
    await db.execute({ sql: "DELETE FROM ai_meal_logs WHERE id = ? AND user_id = ?", args: [id, user.id] });
    return NextResponse.json({ ok: true });
  }

  // Try meals table
  const mealRes = await db.execute({ sql: "SELECT id FROM meals WHERE id = ? AND user_id = ?", args: [id, user.id] });
  if (mealRes.rows.length > 0) {
    await db.execute({ sql: "DELETE FROM meals WHERE id = ? AND user_id = ?", args: [id, user.id] });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
}
