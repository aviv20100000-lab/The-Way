import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { uploadUserAvatar } from "@/lib/blob-storage";
import { isAnthropicImageMediaType } from "@/lib/anthropic";
import { validateImageMagicBytes } from "@/lib/image-validation";
import { sendSecurityAlert } from "@/lib/security-alerts";

async function alertViolation(req: NextRequest, userId: string, targetUserId: string) {
  await sendSecurityAlert({
    event: "avatar_upload_cross_user_attempt",
    severity: "high",
    ip: req.headers.get("x-forwarded-for"),
    identifier: userId,
    details: `tried to upload avatar for ${targetUserId}`,
    cooldownMs: 30 * 60 * 1000,
  });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    await initDb();

    const formData = await req.formData();
    const photo = formData.get("photo");
    const requestedUserId = formData.get("userId");
    if (requestedUserId !== null && (typeof requestedUserId !== "string" || !requestedUserId.trim())) {
      return NextResponse.json({ error: "userId לא תקין" }, { status: 400 });
    }
    const targetUserId = typeof requestedUserId === "string" ? requestedUserId.trim() : user.id;

    if (targetUserId !== user.id) {
      if (user.role !== "coach") {
        await alertViolation(req, user.id, targetUserId);
        return NextResponse.json({ error: "אין הרשאה לעדכן תמונה למשתמש אחר" }, { status: 403 });
      }
      const target = await db.execute({
        sql: "SELECT id FROM users WHERE id = ? AND role = 'client' AND coach_id = ? LIMIT 1",
        args: [targetUserId, user.id],
      });
      if (!target.rows[0]) {
        await alertViolation(req, user.id, targetUserId);
        return NextResponse.json({ error: "המתאמן אינו שייך למאמן" }, { status: 403 });
      }
    }

    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "צריך להעלות תמונה" }, { status: 400 });
    }
    if (!isAnthropicImageMediaType(photo.type)) {
      return NextResponse.json({ error: "רק קובצי תמונה מותרים (JPEG, PNG, WebP, GIF)" }, { status: 400 });
    }
    const buffer = Buffer.from(await photo.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "התמונה ריקה" }, { status: 400 });
    }
    if (!validateImageMagicBytes(buffer, photo.type)) {
      return NextResponse.json({ error: "קובץ התמונה לא תקין" }, { status: 400 });
    }

    const url = await uploadUserAvatar(buffer, targetUserId, photo.type);
    await db.execute({ sql: "UPDATE users SET avatar_url = ? WHERE id = ?", args: [url, targetUserId] });
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת העלאת תמונה";
    console.error("[auth/avatar POST]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
