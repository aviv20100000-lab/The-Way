import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import db, { initDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();

  try {
    const body = await req.json();
    const items = Array.isArray(body.items) ? body.items : [];
    const total = Math.round(Number(body.total_calories) || 0);

    if (items.length === 0) {
      return NextResponse.json({ error: "אין פריטים לשמירה" }, { status: 400 });
    }

    const id = uuid();
    await db.execute({
      sql: `INSERT INTO ai_meal_logs (id, user_id, photo_url, ai_response, total_calories, logged_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [id, user.id, "", JSON.stringify({ items }), total],
    });

    return NextResponse.json({ id });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("log-meal error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
