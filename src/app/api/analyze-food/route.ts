import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { analyzeFoodPhoto } from "@/lib/claude";
import db from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(req: NextRequest) {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const formData = await req.formData();
  const photo = formData.get("photo") as File | null;
  if (!photo) return NextResponse.json({ error: "לא צורפה תמונה" }, { status: 400 });

  const bytes = await photo.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const uploadsDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const filename = `${uuid()}.jpg`;
  await writeFile(join(uploadsDir, filename), buffer);
  const photoUrl = `/uploads/${filename}`;

  const result = await analyzeFoodPhoto(buffer.toString("base64"), photo.type || "image/jpeg");

  await db.execute({
    sql: "INSERT INTO ai_meal_logs (id, user_id, photo_url, ai_response, total_calories) VALUES (?, ?, ?, ?, ?)",
    args: [uuid(), session.id, photoUrl, JSON.stringify(result), result.total_calories],
  });

  return NextResponse.json({ ...result, photo_url: photoUrl });
}
