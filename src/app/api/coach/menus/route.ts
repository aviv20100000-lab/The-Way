import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSessionUser } from "@/lib/auth";
import db, { initDb } from "@/lib/db";

async function ownedClient(coachId: string, clientId: string) {
  const result = await db.execute({
    sql: "SELECT id FROM users WHERE id = ? AND coach_id = ? AND role = 'client'",
    args: [clientId, coachId],
  });
  return result.rows.length > 0;
}

export async function GET(req: NextRequest) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const clientId = req.nextUrl.searchParams.get("clientId")?.trim();
  if (!clientId) return NextResponse.json({ error: "חסר clientId" }, { status: 400 });

  await initDb();
  if (!(await ownedClient(coach.id, clientId))) {
    return NextResponse.json({ error: "המתאמן לא נמצא" }, { status: 404 });
  }

  const result = await db.execute({
    sql: `SELECT id, client_id, title, daily_calories_target, daily_protein_target,
                 is_template, status, created_at, updated_at
          FROM menu_plans
          WHERE coach_id = ? AND client_id = ?
          ORDER BY updated_at DESC, created_at DESC`,
    args: [coach.id, clientId],
  });
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  await initDb();
  const body = await req.json();
  const clientId = typeof body?.client_id === "string" ? body.client_id.trim() : "";
  if (!clientId) return NextResponse.json({ error: "חסר client_id" }, { status: 400 });
  if (!(await ownedClient(coach.id, clientId))) {
    return NextResponse.json({ error: "המתאמן לא נמצא" }, { status: 404 });
  }

  const id = uuid();
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : "תפריט";
  const calories = body?.daily_calories_target == null
    ? null
    : Number.isFinite(Number(body.daily_calories_target))
      ? Math.max(0, Math.round(Number(body.daily_calories_target)))
      : null;
  const protein = body?.daily_protein_target == null
    ? null
    : Number.isFinite(Number(body.daily_protein_target))
      ? Math.max(0, Math.round(Number(body.daily_protein_target)))
      : null;
  const statements = [
    {
      sql: `INSERT INTO menu_plans
              (id, coach_id, client_id, title, daily_calories_target, daily_protein_target, status)
            VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
      args: [id, coach.id, clientId, title, calories, protein],
    },
    ...Array.from({ length: 7 }, (_, dayIndex) => ({
      sql: "INSERT INTO menu_days (id, menu_plan_id, day_index) VALUES (?, ?, ?)",
      args: [uuid(), id, dayIndex],
    })),
  ];
  await db.batch(statements, "write");
  return NextResponse.json({ id, client_id: clientId, title, daily_calories_target: calories, daily_protein_target: protein, status: "draft" }, { status: 201 });
}
