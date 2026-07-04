import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (user.role !== "coach") return NextResponse.json({ error: "רק מאמנים יכולים לשנות את השם" }, { status: 403 });

  try {
    await initDb();
    const body = await req.json() as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 40) {
      return NextResponse.json({ error: "השם חייב להכיל 1–40 תווים" }, { status: 400 });
    }

    await db.execute({
      sql: "UPDATE users SET default_group_name = ? WHERE id = ?",
      args: [name, user.id],
    });

    return NextResponse.json({ name });
  } catch (error) {
    console.error("[coach/default-group-name POST]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
