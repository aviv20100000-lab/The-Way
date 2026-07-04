import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { uploadMealPhoto } from "@/lib/blob-storage";
import { isAnthropicImageMediaType } from "@/lib/anthropic";
import { validateImageMagicBytes } from "@/lib/image-validation";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

    const formData = await req.formData();
    const photo = formData.get("photo");

    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "צריך להעלות תמונה" }, { status: 400 });
    }

    // Match the analyze endpoint's accepted types — compression can fall back to
    // the original file (e.g. HEIC-from-camera decode issues), so it isn't always jpeg.
    if (!isAnthropicImageMediaType(photo.type)) {
      return NextResponse.json({ error: "רק קבצי תמונה מותרים (JPEG, PNG, WebP, GIF)" }, { status: 400 });
    }

    const buffer = Buffer.from(await photo.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "התמונה ריקה" }, { status: 400 });
    }

    if (!validateImageMagicBytes(buffer, photo.type)) {
      return NextResponse.json({ error: "קובץ התמונה לא תקין" }, { status: 400 });
    }

    const url = await uploadMealPhoto(buffer, user.id, photo.type);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת העלאת תמונה";
    console.error("[foods/meals/photo-upload POST]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
