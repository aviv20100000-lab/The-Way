import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { extractStepsFromScreenshotBase64 } from "@/lib/anthropic";
import { v4 as uuid } from "uuid";
import db, { initDb } from "@/lib/db";
import { checkPersistentRateLimit, formatResetIn } from "@/lib/ratelimit";
import { getDayRangeUtc, getTodayDayKey } from "@/lib/daily-summary";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const rateLimit = await checkPersistentRateLimit(`steps-analyze:${user.id}`, "stepsScan");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `הגעת למגבלת 2 סריקות צעדים ליום. נסה שוב בעוד ${formatResetIn(rateLimit.resetIn)} 🙏` },
      { status: 429 }
    );
  }

  await initDb();
  const formData = await req.formData();
  const screenshot = formData.get("screenshot") as File | null;

  if (!screenshot) {
    return NextResponse.json({ error: "צריך להעלות סקרינשוט" }, { status: 400 });
  }

  const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!validMimeTypes.includes(screenshot.type)) {
    return NextResponse.json({ error: "רק קבצי תמונה מותרים (JPEG, PNG, WebP, GIF)" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await screenshot.arrayBuffer());

    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "הסקרינשוט גדול מדי (מקסימום 10MB)" }, { status: 413 });
    }

    const base64 = buffer.toString("base64");
    const steps = await extractStepsFromScreenshotBase64(base64, screenshot.type);

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

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const type = req.nextUrl.searchParams.get("type");

  if (type === "leaderboard") {
    const userRes = await db.execute({
      sql: "SELECT coach_id, role FROM users WHERE id = ?",
      args: [user.id],
    });

    const userData = userRes.rows[0] as unknown as { coach_id: string; role: string };
    const coachId = userData?.role === "coach" ? user.id : userData?.coach_id;

    if (!coachId) {
      return NextResponse.json([]);
    }

    const todayKey = getTodayDayKey();
    const todayRange = getDayRangeUtc(todayKey);
    const weekStart = new Date(`${todayKey}T12:00:00Z`);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    const weekStartKey = weekStart.toISOString().slice(0, 10);
    const weekStartUtc = getDayRangeUtc(weekStartKey).startUtc;

    const lbRes = await db.execute({
      sql: `
        SELECT
          u.id,
          u.name,
          COALESCE(SUM(CASE WHEN s.logged_at >= ? AND s.logged_at < ? THEN s.steps ELSE 0 END), 0) as today,
          COALESCE(SUM(CASE WHEN s.logged_at >= ? THEN s.steps ELSE 0 END), 0) as week
        FROM users u
        LEFT JOIN steps_logs s ON u.id = s.user_id
        WHERE u.coach_id = ?
        GROUP BY u.id
        ORDER BY week DESC
      `,
      args: [todayRange.startUtc, todayRange.endUtc, weekStartUtc, coachId],
    });

    return NextResponse.json(lbRes.rows);
  }

  const { startUtc, endUtc } = getDayRangeUtc(getTodayDayKey());
  const todayRes = await db.execute({
    sql: `
      SELECT COALESCE(SUM(steps), 0) as steps FROM steps_logs
      WHERE user_id = ? AND logged_at >= ? AND logged_at < ?
    `,
    args: [user.id, startUtc, endUtc],
  });

  const steps = (todayRes.rows[0]?.steps as number) || 0;
  return NextResponse.json({ steps });
}
