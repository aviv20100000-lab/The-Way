import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuid } from "uuid";
import { getSessionUser } from "@/lib/auth";
import { createMeal, getMealsByUser, getMealsForCoach } from "@/lib/meals";
import { ensureSeed } from "@/lib/seed";
import type { MealType } from "@/lib/types";

export async function GET(req: NextRequest) {
  await ensureSeed();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date") || undefined;
  if (user.role === "coach") return NextResponse.json(await getMealsForCoach(user.id, date));
  return NextResponse.json(await getMealsByUser(user.id, date));
}

export async function POST(req: NextRequest) {
  await ensureSeed();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (user.role !== "client") return NextResponse.json({ error: "רק מתאמנים יכולים לרשום ארוחות" }, { status: 403 });

  const formData = await req.formData();
  const mealType = formData.get("mealType") as MealType;
  const notes = (formData.get("notes") as string) || undefined;
  const itemsJson = formData.get("items") as string;
  const photo = formData.get("photo") as File | null;

  if (!mealType || !itemsJson) return NextResponse.json({ error: "חסרים פרטי ארוחה" }, { status: 400 });

  let items: { foodId: string; quantity: number }[];
  try { items = JSON.parse(itemsJson); } catch { return NextResponse.json({ error: "פורמט פריטים לא תקין" }, { status: 400 }); }
  if (items.length === 0) return NextResponse.json({ error: "יש להוסיף לפחות מזון אחד" }, { status: 400 });

  let photoUrl: string | undefined;
  if (photo && photo.size > 0) {
    const VALID_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    const ext = (photo.name.split(".").pop() || "jpg").toLowerCase();
    if (!VALID_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "סוג קובץ לא מותר (jpg, png, gif, webp בלבד)" }, { status: 400 });
    }
    if (photo.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "קובץ גדול מדי (עד 10MB)" }, { status: 400 });
    }

    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const filename = `${uuid()}.${ext}`;
    await writeFile(join(uploadsDir, filename), Buffer.from(await photo.arrayBuffer()));
    photoUrl = `/uploads/${filename}`;
  }

  const mealId = await createMeal({ userId: user.id, photoUrl, mealType, notes, items });
  return NextResponse.json({ id: mealId, photoUrl });
}
