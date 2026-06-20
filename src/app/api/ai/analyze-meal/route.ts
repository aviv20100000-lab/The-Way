import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { analyzeFoodPhoto } from "@/lib/anthropic";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuid } from "uuid";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const formData = await req.formData();
  const photo = formData.get("photo") as File | null;

  if (!photo) {
    return NextResponse.json({ error: "צריך להעלות תמונה" }, { status: 400 });
  }

  const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!validMimeTypes.includes(photo.type)) {
    return NextResponse.json({ error: "רק קבצי תמונה מותרים (JPEG, PNG, WebP, GIF)" }, { status: 400 });
  }

  const buffer = Buffer.from(await photo.arrayBuffer());

  if (buffer.length > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "התמונה גדולה מדי (מקסימום 10MB)" }, { status: 413 });
  }

  // Save photo with safe filename
  const uploadsDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const mimeExtMap: { [key: string]: string } = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ext = mimeExtMap[photo.type] || "jpg";
  const filename = `${uuid()}.${ext}`;

  try {
    await writeFile(join(uploadsDir, filename), buffer);
  } catch (error) {
    console.error("File write error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת הקובץ" }, { status: 500 });
  }

  const photoUrl = `/uploads/${filename}`;

  // Analyze with Claude
  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
    const analysis = await analyzeFoodPhoto(`${baseUrl}${photoUrl}`);

    const mealId = uuid();
    db.prepare(`
      INSERT INTO ai_meal_logs (id, user_id, photo_url, ai_response)
      VALUES (?, ?, ?, ?)
    `).run(mealId, user.id, photoUrl, JSON.stringify(analysis));

    // Format response for client
    const items = Array.isArray(analysis) ? analysis : analysis.items || [];
    const totalCalories = items.reduce((sum: number, item: { calories?: number }) => sum + (item.calories || 0), 0);

    return NextResponse.json({
      items: items.map((item: any) => ({
        name: item.name_he || item.name,
        estimated_weight_g: item.estimated_weight_g || 100,
        calories: item.calories || 0,
        protein_g: item.protein || 0,
        carbs_g: item.carbs || 0,
        fat_g: item.fat || 0,
      })),
      total_calories: Math.round(totalCalories),
      photo_url: photoUrl,
      mealId,
    });
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json({ error: "שגיאה בניתוח התמונה" }, { status: 500 });
  }
}
