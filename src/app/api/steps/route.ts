import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { analyzeStepsScreenshot } from "@/lib/claude";
import db from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function GET(req: NextRequest) {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const type = new URL(req.url).searchParams.get("type") || "today";
  const today = new Date().toISOString().split("T")[0];

  if (type === "leaderboard") {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split("T")[0];

    let coachId = session.role === "coach" ? session.id : null;
    if (!coachId) {
      const r = await db.execute({ sql: "SELECT coach_id FROM users WHERE id = ?", args: [session.id] });
      coachId = r.rows[0]?.coach_id as string | null;
    }
    if (!coachId) return NextResponse.json([]);

    const clients = (await db.execute({ sql: "SELECT id, name FROM users WHERE coach_id = ?", args: [coachId] })).rows;
    const leaderboard = await Promise.all(clients.map(async (c) => {
      const todayRow = (await db.execute({ sql: "SELECT COALESCE(MAX(steps),0) as steps FROM steps_logs WHERE user_id=? AND date(logged_at)=?", args: [c.id as string, today] })).rows[0];
      const weekRow = (await db.execute({ sql: "SELECT COALESCE(SUM(steps),0) as steps FROM (SELECT user_id, date(logged_at) as d, MAX(steps) as steps FROM steps_logs WHERE user_id=? AND date(logged_at)>=? GROUP BY d)", args: [c.id as string, weekStartStr] })).rows[0];
      return { id: c.id, name: c.name, today: todayRow.steps as number, week: weekRow.steps as number };
    }));
    leaderboard.sort((a, b) => (b.today as number) - (a.today as number));
    return NextResponse.json(leaderboard);
  }

  const row = (await db.execute({ sql: "SELECT COALESCE(MAX(steps),0) as steps FROM steps_logs WHERE user_id=? AND date(logged_at)=?", args: [session.id, today] })).rows[0];
  return NextResponse.json({ steps: row.steps });
}

export async function POST(req: NextRequest) {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart")) {
    const formData = await req.formData();
    const photo = formData.get("screenshot") as File | null;
    if (!photo) return NextResponse.json({ error: "לא צורפה תמונה" }, { status: 400 });

    const bytes = await photo.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const steps = await analyzeStepsScreenshot(buffer.toString("base64"), photo.type || "image/jpeg");

    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const filename = `steps-${uuid()}.jpg`;
    await writeFile(join(uploadsDir, filename), buffer);

    await db.execute({ sql: "INSERT INTO steps_logs (id, user_id, steps, screenshot_url) VALUES (?,?,?,?)", args: [uuid(), session.id, steps, `/uploads/${filename}`] });
    return NextResponse.json({ steps });
  }

  const { steps } = await req.json();
  if (!steps || steps < 0) return NextResponse.json({ error: "מספר צעדים לא תקין" }, { status: 400 });
  await db.execute({ sql: "INSERT INTO steps_logs (id, user_id, steps) VALUES (?,?,?)", args: [uuid(), session.id, steps] });
  return NextResponse.json({ steps });
}
