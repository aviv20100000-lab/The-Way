import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, setSession, verifyPassword, hashPassword } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { validatePassword } from "@/lib/validation";

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  await initDb();

  const { name, currentPassword, newPassword } = await req.json();

  if (name && name.trim().length < 2) {
    return NextResponse.json({ error: "שם חייב להכיל לפחות 2 תווים" }, { status: 400 });
  }

  if (newPassword) {
    if (!currentPassword) return NextResponse.json({ error: "נדרשת סיסמה נוכחית" }, { status: 400 });
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.error }, { status: 400 });
    }

    const row = (await db.execute({ sql: "SELECT password_hash FROM users WHERE id = ?", args: [user.id] })).rows[0];
    const valid = await verifyPassword(currentPassword, row?.password_hash as string);
    if (!valid) return NextResponse.json({ error: "סיסמה נוכחית שגויה" }, { status: 400 });

    const newHash = await hashPassword(newPassword);
    await db.execute({ sql: "UPDATE users SET password_hash = ? WHERE id = ?", args: [newHash, user.id] });
  }

  const newName = name?.trim() || user.name;
  if (newName !== user.name) {
    await db.execute({ sql: "UPDATE users SET name = ? WHERE id = ?", args: [newName, user.id] });
  }

  // Refresh session cookie with updated name
  await setSession({ ...user, name: newName });
  return NextResponse.json({ ok: true, name: newName });
}
