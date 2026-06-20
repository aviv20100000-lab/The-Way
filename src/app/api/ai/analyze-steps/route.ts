import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { extractStepsFromScreenshot } from "@/lib/anthropic";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuid } from "uuid";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const formData = await req.formData();
  const screenshot = formData.get("screenshot") as File | null;

  if (!screenshot) {
    return NextResponse.json({ error: "צריך להעלות סקרינשוט" }, { status: 400 });
  }

  const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!validMimeTypes.includes(screenshot.type)) {
    return NextResponse.json({ error: "רק קבצי תמונה מותרים (JPEG, PNG, WebP, GIF)" }, { status: 400 });
  }

  const buffer = Buffer.from(await screenshot.arrayBuffer());

  if (buffer.length > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "הסקרינשוט גדול מדי (מקסימום 10MB)" }, { status: 413 });
  }

  // Save screenshot with validated filename
  const uploadsDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const mimeExtMap: { [key: string]: string } = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ext = mimeExtMap[screenshot.type] || "jpg";
  const filename = `${uuid()}.${ext}`;

  try {
    await writeFile(join(uploadsDir, filename), buffer);
  } catch (error) {
    console.error("File write error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת הקובץ" }, { status: 500 });
  }

  const screenshotUrl = `/uploads/${filename}`;

  try {
    const steps = await extractStepsFromScreenshot(`${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}${screenshotUrl}`);

    if (steps === 0) {
      return NextResponse.json(
        { error: "לא הצלחתי לקרוא את מספר הצעדים מהסקרינשוט" },
        { status: 400 }
      );
    }

    const logId = uuid();
    db.prepare(`
      INSERT INTO steps_logs (id, user_id, steps, screenshot_url, logged_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(logId, user.id, steps, screenshotUrl);

    return NextResponse.json({ steps, screenshotUrl });
  } catch (error) {
    console.error("Steps analysis error:", error);
    return NextResponse.json({ error: "שגיאה בקריאת הצעדים" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];
  const logs = db
    .prepare(`
      SELECT * FROM steps_logs
      WHERE user_id = ? AND DATE(logged_at) = ?
      ORDER BY logged_at DESC
    `)
    .all(user.id, today) as Array<{
      id: string;
      user_id: string;
      steps: number;
      screenshot_url: string;
      logged_at: string;
    }>;

  return NextResponse.json(logs);
}
