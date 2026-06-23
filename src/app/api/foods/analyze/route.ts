import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  analyzeFoodPhotoBase64,
  isAnthropicImageMediaType,
  MAX_ANTHROPIC_IMAGE_BYTES,
} from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

    const formData = await req.formData();
    const photo = formData.get("photo");

    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "צריך להעלות תמונה" }, { status: 400 });
    }

    if (!isAnthropicImageMediaType(photo.type)) {
      return NextResponse.json({ error: "רק קבצי תמונה מותרים (JPEG, PNG, WebP, GIF)" }, { status: 400 });
    }

    const buffer = Buffer.from(await photo.arrayBuffer());
    const sizeKB = Math.round(buffer.length / 1024);

    if (buffer.length === 0) {
      return NextResponse.json({ error: "התמונה ריקה" }, { status: 400 });
    }

    if (buffer.length > MAX_ANTHROPIC_IMAGE_BYTES) {
      return NextResponse.json({ error: "התמונה גדולה מדי (מקסימום 7.5MB)" }, { status: 413 });
    }

    console.log(`analyze-food: received ${sizeKB}KB, type=${photo.type}`);

    const base64 = buffer.toString("base64");
    const analysis = await analyzeFoodPhotoBase64(base64, photo.type);

    const items = Array.isArray(analysis) ? analysis : (analysis.items ?? []);
    const totalCalories = items.reduce(
      (sum: number, item: { calories?: number }) => sum + (item.calories || 0),
      0
    );

    return NextResponse.json({
      items: items.map((item: Record<string, unknown>) => ({
        name: item.name_he || item.name,
        estimated_weight_g: item.estimated_weight_g || 100,
        calories: item.calories || 0,
        protein_g: item.protein || 0,
        carbs_g: item.carbs || 0,
        fat_g: item.fat || 0,
      })),
      total_calories: Math.round(totalCalories),
      photo_url: "",
      notes: "",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("analyze-food error:", msg);
    return NextResponse.json({ error: "אירעה שגיאה בניתוח התמונה. נסה שוב מאוחר יותר." }, { status: 500 });
  }
}
