import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createMeal } from "@/lib/meals";
import { ensureSeed } from "@/lib/seed";
import type { MealType } from "@/lib/types";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (user.role !== "client") return NextResponse.json({ error: "רק מתאמנים יכולים לרשום ארוחות" }, { status: 403 });
  await ensureSeed();

  const body = await req.json();
  const { foodId, quantity, mealType } = body as { foodId: string; quantity: number; mealType: MealType };

  if (!foodId || !quantity || !mealType) {
    return NextResponse.json({ error: "חסרים פרטים" }, { status: 400 });
  }

  const mealId = await createMeal({ userId: user.id, mealType, items: [{ foodId, quantity }] });
  return NextResponse.json({ id: mealId });
}
