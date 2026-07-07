import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkPersistentRateLimit, formatResetIn } from "@/lib/ratelimit";
import { suggestMenuFoods } from "@/lib/menu-suggest";

export async function POST(req: NextRequest) {
  const coach = await getSessionUser();
  if (!coach || coach.role !== "coach") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const rateLimit = await checkPersistentRateLimit(`menu-suggest:${coach.id}`, "menuSuggest");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `הגעת למגבלת ההצעות היומית. נסה שוב בעוד ${formatResetIn(rateLimit.resetIn)} 🙏` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const request = typeof body?.request === "string" ? body.request.trim().slice(0, 300) : "";
  if (!request) return NextResponse.json({ error: "חסר תיאור למה שמחפשים" }, { status: 400 });

  const dailyCalories = Number.isFinite(Number(body?.dailyCalories)) ? Number(body.dailyCalories) : null;
  const dailyProtein = Number.isFinite(Number(body?.dailyProtein)) ? Number(body.dailyProtein) : null;

  try {
    const suggestions = await suggestMenuFoods(request, { dailyCalories, dailyProtein });
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[coach/menus/suggest POST]", error);
    return NextResponse.json({ error: "לא הצלחנו לקבל הצעות כרגע. נסה שוב." }, { status: 500 });
  }
}
