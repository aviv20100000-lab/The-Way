import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, createUser, getClientsByCoach } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { validateEmail, validatePassword, validateName } from "@/lib/validation";
import db from "@/lib/db";

export async function GET() {
  await ensureSeed();
  const user = await getSessionUser();
  if (!user || user.role !== "coach") return NextResponse.json({ error: "גישה נדחתה" }, { status: 403 });
  const clients = await getClientsByCoach(user.id);
  const avatars = await db.execute({
    sql: "SELECT id, avatar_url FROM users WHERE coach_id = ? AND role = 'client'",
    args: [user.id],
  });
  const avatarById = new Map(avatars.rows.map((row) => [String(row.id), row.avatar_url ? String(row.avatar_url) : null]));
  return NextResponse.json(clients.map((client) => ({
    ...client,
    avatar_url: avatarById.get(client.id) ?? null,
  })));
}

export async function POST(req: NextRequest) {
  await ensureSeed();
  const user = await getSessionUser();
  if (!user || user.role !== "coach") return NextResponse.json({ error: "גישה נדחתה" }, { status: 403 });

  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "נא למלא את כל השדות" }, { status: 400 });
  }

  if (!validateName(name)) {
    return NextResponse.json({ error: "שם לא תקין (2-100 תווים)" }, { status: 400 });
  }

  if (!validateEmail(email)) {
    return NextResponse.json({ error: "אימייל לא תקין" }, { status: 400 });
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return NextResponse.json({ error: passwordCheck.error }, { status: 400 });
  }

  try {
    const client = await createUser({ name, email, password, role: "client", coachId: user.id });
    return NextResponse.json(client);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "";
    if (errorMsg.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: "האימייל כבר קיים במערכת" }, { status: 409 });
    }
    return NextResponse.json({ error: "שגיאה בהוספת מתאמן" }, { status: 500 });
  }
}
