import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { extractStepsFromScreenshot } from "@/lib/anthropic";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuid } from "uuid";
import db, { initDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  const formData = await req.formData();
  const screenshot = formData.get("screenshot") as File | null;

  if (!screenshot) {
    return NextResponse.json({ error: "צריך להעלות סקרינשוט" }, { status: 400 });
  }

  // Save screenshot
  const uploadsDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const filename = `${uuid()}.jpg`;
  const buffer = Buffer.from(await screenshot.arrayBuffer());
  await writeFile(join(uploadsDir, filename), buffer);
  const screenshotUrl = `/uploads/${filename}`;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
    const steps = await extractStepsFromScreenshot(`${baseUrl}${screenshotUrl}`);

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
      args: [logId, user.id, steps, screenshotUrl],
    });

    return NextResponse.json({ steps, screenshotUrl });
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
    
    const userData = userRes.rows[0] as { coach_id: string; role: string };
    const coachId = userData?.role === "coach" ? user.id : userData?.coach_id;
    
    if (!coachId) {
      return NextResponse.json([]);
    }

    const today = new Date().toISOString().split("T")[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const lbRes = await db.execute({
      sql: `
        SELECT 
          u.id,
          u.name,
          COALESCE(SUM(CASE WHEN DATE(s.logged_at) = ? THEN s.steps ELSE 0 END), 0) as today,
          COALESCE(SUM(CASE WHEN DATE(s.logged_at) >= ? THEN s.steps ELSE 0 END), 0) as week
        FROM users u
        LEFT JOIN steps_logs s ON u.id = s.user_id
        WHERE u.coach_id = ?
        GROUP BY u.id
        ORDER BY week DESC
      `,
      args: [today, weekStartStr, coachId],
    });

    return NextResponse.json(lbRes.rows);
  }

  // Get today's steps
  const today = new Date().toISOString().split("T")[0];
  const todayRes = await db.execute({
    sql: `
      SELECT COALESCE(SUM(steps), 0) as steps FROM steps_logs
      WHERE user_id = ? AND DATE(logged_at) = ?
    `,
    args: [user.id, today],
  });

  const steps = (todayRes.rows[0]?.steps as number) || 0;
  return NextResponse.json({ steps });
}
