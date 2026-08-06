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
    weigh_in_frequency_weeks: null,
    weigh_in_weekday: null,
  });
}

// Bounds are generous on purpose — this only needs to catch typos and stray
// negative signs, not second-guess a coach's programming.
const GOAL_BOUNDS: Record<string, [number, number]> = {
  target_weight_kg: [20, 400],
  daily_calories: [200, 10000],
  daily_protein_g: [0, 800],
  daily_water_ml: [0, 15000],
  daily_steps: [0, 100000],
  weigh_in_frequency_weeks: [1, 52],
  weigh_in_weekday: [0, 6],
};

function validateGoalField(key: string, value: unknown): string | null {
  const bounds = GOAL_BOUNDS[key];
  if (!bounds || value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return `ערך לא תקין עבור ${key}`;
  const [min, max] = bounds;
  if (num < min || num > max) return `הערך עבור ${key} חייב להיות בין ${min} ל-${max}`;
  return null;
}

export async function POST(req: NextRequest) {
  await ensureSeed();
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const body = await req.json();

  for (const key of Object.keys(GOAL_BOUNDS)) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const error = validateGoalField(key, body[key]);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }

  const userId = session.role === "coach" && body.userId ? body.userId : session.id;

  if (session.role === "coach" && body.userId) {
    const owner = (await db.execute({ sql: "SELECT coach_id FROM users WHERE id = ?", args: [userId] })).rows[0];
    if (!owner || owner.coach_id !== session.id) {
      return NextResponse.json({ error: "גישה נדחתה" }, { status: 403 });
    }
  }

  await db.execute({
    sql: `INSERT INTO goals (user_id, target_weight_kg, daily_calories, daily_protein_g, daily_water_ml, daily_steps, weigh_in_frequency_weeks, weigh_in_weekday)
          VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET
            target_weight_kg=CASE WHEN ? THEN excluded.target_weight_kg ELSE goals.target_weight_kg END,
            daily_calories=CASE WHEN ? THEN excluded.daily_calories ELSE goals.daily_calories END,
            daily_protein_g=CASE WHEN ? THEN excluded.daily_protein_g ELSE goals.daily_protein_g END,
            daily_water_ml=CASE WHEN ? THEN excluded.daily_water_ml ELSE goals.daily_water_ml END,
            daily_steps=CASE WHEN ? THEN excluded.daily_steps ELSE goals.daily_steps END,
            weigh_in_frequency_weeks=CASE WHEN ? THEN excluded.weigh_in_frequency_weeks ELSE goals.weigh_in_frequency_weeks END,
            weigh_in_weekday=CASE WHEN ? THEN excluded.weigh_in_weekday ELSE goals.weigh_in_weekday END,
            updated_at=datetime('now')`,
    args: [
      userId,
      body.target_weight_kg ?? null,
      body.daily_calories ?? null,
      body.daily_protein_g ?? null,
      body.daily_water_ml ?? 2000,
      body.daily_steps ?? null,
      body.weigh_in_frequency_weeks ?? null,
      body.weigh_in_weekday ?? null,
      Object.prototype.hasOwnProperty.call(body, "target_weight_kg") ? 1 : 0,
      Object.prototype.hasOwnProperty.call(body, "daily_calories") ? 1 : 0,
      Object.prototype.hasOwnProperty.call(body, "daily_protein_g") ? 1 : 0,
      Object.prototype.hasOwnProperty.call(body, "daily_water_ml") ? 1 : 0,
      Object.prototype.hasOwnProperty.call(body, "daily_steps") ? 1 : 0,
      Object.prototype.hasOwnProperty.call(body, "weigh_in_frequency_weeks") ? 1 : 0,
      Object.prototype.hasOwnProperty.call(body, "weigh_in_weekday") ? 1 : 0,
    ],
  });

  return NextResponse.json({ ok: true });
}
