import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

// POST /api/coach/group-membership — add/remove a client from the coach's default chat group
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "coach") {
    return NextResponse.json({ error: "גישה נדחתה" }, { status: 403 });
  }

  try {
    await initDb();

    const body = await req.json();
    const clientId = typeof body?.clientId === "string" ? body.clientId : null;
    const inGroup = body?.inGroup === true;
    if (!clientId) {
      return NextResponse.json({ error: "חסר clientId" }, { status: 400 });
    }

    // Only this coach's own clients can be toggled
    const result = await db.execute({
      sql: "UPDATE users SET in_default_group = ? WHERE id = ? AND coach_id = ? AND role = 'client'",
      args: [inGroup ? 1 : 0, clientId, user.id],
    });
    if (result.rowsAffected === 0) {
      return NextResponse.json({ error: "מתאמן לא נמצא" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, inGroup });
  } catch (error) {
    console.error("[coach/group-membership POST]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
