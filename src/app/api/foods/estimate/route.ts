import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { estimateNutritionByName } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const grams = Math.max(1, Math.round(Number(body.grams) || 100));

    if (!name) {
      return NextResponse.json({ error: "צריך שם מאכל" }, { status: 400 });
    }

    const nutrition = await estimateNutritionByName(name, grams);
    return NextResponse.json(nutrition);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("estimate-food error:", msg);
    return NextResponse.json({ error: "אירעה שגיאה בזיהוי הקלוריות. נסה שוב." }, { status: 500 });
  }
}
