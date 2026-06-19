import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { extractStepsFromScreenshotBase64 } from "@/lib/anthropic";
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

  try {
    const buffer = Buffer.from(await screenshot.arrayBuffer());
    const base64 = buffer.toString("base64");
    const steps = await extractStepsFromScreenshotBase64(base64, screenshot.type || "image/jpeg");

    if (steps === 0) {
      return NextResponse.json(
        { error: "לא הצלחתי לקרוא את מספר הצעדים מהסקרינשוט" },
        { status: 400 }
      );
    }

    const logId = uuid();
    await db.execute({
      sql: `INSERT INTO steps_logs (id, user_id, steps, screenshot_url, logged_at)
            VALUES (?, ?, ?, ?, datetime('now'))`,
      args: [logId, user.id, steps, ""],
    });

    return NextResponse.json({ steps });
  } catch (error) {
    console.error("Steps analysis error:", error);
    return NextResponse.json({ error: "שגיאה בקריאת הצעדים" }, { status: 500 });
  }
}
