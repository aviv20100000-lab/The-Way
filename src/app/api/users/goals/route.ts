import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { ensureSeed } from "@/lib/seed";

export async function GET(req: NextRequest) {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  let userId = new URL(req.url).searchParams.get("userId") || session.id;

  if (userId !== session.id) {
    if (session.role !== "coach") {
      return NextResponse.json({ error: "גישה נדחתה" }, { status: 403 });
    }
    const owner = (await db.execute({ sql: "SELECT coach_id FROM users WHERE id = ?", args: [userId] })).rows[0];
    if (!owner || owner.coach_id !== session.id) {
      return NextResponse.json({ error: "גישה נדחתה" }, { status: 403 });
    }
  }

  const goal = (await db.execute({ sql: "SELECT * FROM goals WHERE user_id=?", args: [userId] })).rows[0];
  return NextResponse.json(goal ?? {
    user_id: userId,
    target_weight_kg: null,
    daily_calories: null,
    daily_protein_g: null,
    daily_water_ml: 2000,
    daily_steps: null,
  });
}

export async function POST(req: NextRequest) {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const body = await req.json();
  const userId = session.role === "coach" && body.userId ? body.userId : session.id;

  if (session.role === "coach" && body.userId) {
    const owner = (await db.execute({ sql: "SELECT coach_id FROM users WHERE id = ?", args: [userId] })).rows[0];
    if (!owner || owner.coach_id !== session.id) {
      return NextResponse.json({ error: "גישה נדחתה" }, { status: 403 });
    }
  }

  await db.execute({
    sql: `INSERT INTO goals (user_id, target_weight_kg, daily_calories, daily_protein_g, daily_water_ml, daily_steps)
          VALUES (?,?,?,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET
            target_weight_kg=COALESCE(excluded.target_weight_kg, goals.target_weight_kg),
            daily_calories=COALESCE(excluded.daily_calories, goals.daily_calories),
            daily_protein_g=COALESCE(excluded.daily_protein_g, goals.daily_protein_g),
            daily_water_ml=CASE WHEN ? THEN COALESCE(?, goals.daily_water_ml) ELSE goals.daily_water_ml END,
            daily_steps=COALESCE(excluded.daily_steps, goals.daily_steps),
            updated_at=datetime('now')`,
    args: [
      userId,
      body.target_weight_kg ?? null,
      body.daily_calories ?? null,
      body.daily_protein_g ?? null,
      body.daily_water_ml ?? 2000,
      body.daily_steps ?? null,
      Object.prototype.hasOwnProperty.call(body, "daily_water_ml") ? 1 : 0,
      body.daily_water_ml ?? null,
    ],
  });

  return NextResponse.json({ ok: true });
}
