import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function GET(req: NextRequest) {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const userId = new URL(req.url).searchParams.get("userId") || session.id;
  if (userId !== session.id && session.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const logs = (await db.execute({ sql: "SELECT id, weight_kg, photo_url, logged_at FROM weight_logs WHERE user_id=? ORDER BY logged_at DESC LIMIT 30", args: [userId] })).rows;
  const goal = (await db.execute({ sql: "SELECT target_weight_kg FROM goals WHERE user_id=?", args: [userId] })).rows[0];
  return NextResponse.json({ logs, target: goal?.target_weight_kg ?? null });
}

export async function POST(req: NextRequest) {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";
  let weight_kg: number;
  let photoUrl: string | null = null;

  if (contentType.includes("multipart")) {
    const formData = await req.formData();
    weight_kg = parseFloat(formData.get("weight") as string);
    const photo = formData.get("photo") as File | null;
    if (photo) {
      const buffer = Buffer.from(await photo.arrayBuffer());
      const uploadsDir = join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });
      const filename = `weight-${uuid()}.jpg`;
      await writeFile(join(uploadsDir, filename), buffer);
      photoUrl = `/uploads/${filename}`;
    }
  } else {
    weight_kg = (await req.json()).weight_kg;
  }

  if (!weight_kg || weight_kg < 20 || weight_kg > 300) return NextResponse.json({ error: "משקל לא תקין" }, { status: 400 });

  await db.execute({ sql: "INSERT INTO weight_logs (id, user_id, weight_kg, photo_url) VALUES (?,?,?,?)", args: [uuid(), session.id, weight_kg, photoUrl] });
  return NextResponse.json({ ok: true });
}
