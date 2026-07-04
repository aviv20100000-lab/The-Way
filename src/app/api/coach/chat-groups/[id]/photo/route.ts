import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";
import { isGroupOwner } from "@/lib/chat-group";
import { uploadGroupPhoto } from "@/lib/blob-storage";
import { isAnthropicImageMediaType } from "@/lib/anthropic";
import { validateImageMagicBytes } from "@/lib/image-validation";
import { sendSecurityAlert } from "@/lib/security-alerts";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    await initDb();
    const { id: groupId } = await context.params;

    if (user.role !== "coach" || !(await isGroupOwner(groupId, user.id))) {
      await sendSecurityAlert({
        event: "chat_group_photo_ownership_violation",
        severity: "high",
        ip: req.headers.get("x-forwarded-for"),
        identifier: user.id,
        details: `tried to upload photo for group ${groupId}`,
        cooldownMs: 30 * 60 * 1000,
      });
      return NextResponse.json({ error: "אין הרשאה לעדכן את תמונת הקבוצה" }, { status: 403 });
    }

    const formData = await req.formData();
    const photo = formData.get("photo");
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

    const url = await uploadGroupPhoto(buffer, groupId, photo.type);
    await db.execute({ sql: "UPDATE chat_groups SET image_url = ? WHERE id = ?", args: [url, groupId] });
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת העלאת תמונה";
    console.error("[coach/chat-groups/photo POST]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
