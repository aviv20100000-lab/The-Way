import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  analyzeFoodPhotoBase64,
  isAnthropicImageMediaType,
  MAX_ANTHROPIC_IMAGE_BYTES,
} from "@/lib/anthropic";
import { checkPersistentRateLimit } from "@/lib/ratelimit";
import { matchTzameret } from "@/lib/tzameret";

export async function POST(req: NextRequest) {
  const timingStartedAt = Date.now();
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    const rateLimit = await checkPersistentRateLimit(`foods-analyze:${user.id}`, "api");
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "יותר מדי ניסיונות. נסה שוב בעוד דקה." }, { status: 429 });
    }

    const formData = await req.formData();
    const photo = formData.get("photo");
    const compressionField = formData.get("client_compression");
    const clientCompression = compressionField === "ok" || compressionField === "fallback"
      ? compressionField
      : "unknown";

    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "צריך להעלות תמונה" }, { status: 400 });
    }

    if (!isAnthropicImageMediaType(photo.type)) {
      return NextResponse.json({ error: "רק קבצי תמונה מותרים (JPEG, PNG, WebP, GIF)" }, { status: 400 });
    }

    const buffer = Buffer.from(await photo.arrayBuffer());
    const parseFinishedAt = Date.now();
    const sizeKB = Math.round(buffer.length / 1024);

    if (buffer.length === 0) {
      return NextResponse.json({ error: "התמונה ריקה" }, { status: 400 });
    }

    if (buffer.length > MAX_ANTHROPIC_IMAGE_BYTES) {
      return NextResponse.json({ error: "התמונה גדולה מדי (מקסימום 7.5MB)" }, { status: 413 });
    }

    console.log(`analyze-food: received ${sizeKB}KB, type=${photo.type}`);

    const base64 = buffer.toString("base64");
    const aiStartedAt = Date.now();
    const analysis = await analyzeFoodPhotoBase64(base64, photo.type);
    const aiFinishedAt = Date.now();

    const raw = Array.isArray(analysis) ? analysis : (analysis.items ?? []);

    // Keep the model values as a fallback; confidence still controls manual clarification.
    const mapped = raw.map((item: Record<string, unknown>) => {
      const conf = typeof item.confidence === "number" ? item.confidence : 1;
      const lowConfidence = conf < 0.6;

      const protein_g = Number(item.protein) || 0;
      const carbs_g   = Number(item.carbs)   || 0;
      const fat_g     = Number(item.fat)      || 0;
      const reported  = Number(item.calories) || 0;

      const calcCals = Math.round(protein_g * 4 + carbs_g * 4 + fat_g * 9);
      const variance = calcCals > 0 ? Math.abs(calcCals - reported) / Math.max(reported, 1) : 0;
      const calories = Math.max(1, variance > 0.15 && calcCals > 0 ? calcCals : reported);

      return {
        name: String(item.name_he || item.name || ""),
        estimated_weight_g: Number(item.estimated_weight_g) || 100,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        confidence: conf,
        needsManualEntry: lowConfidence,
        source: "ai" as const,
      };
    });

    // Official Tzameret values replace model nutrition whenever the name matches.
    const tzameretStartedAt = Date.now();
    const enriched = await Promise.all(
      mapped.map(async (item: typeof mapped[number]) => {
        if (!item.name) return item;
        try {
          const dbFood = await matchTzameret(item.name);
          if (!dbFood) return item;
          const ratio = item.estimated_weight_g / 100;
          return {
            ...item,
            calories: Math.round(dbFood.calories * ratio),
            protein_g: Math.round(dbFood.protein * ratio),
            carbs_g: Math.round(dbFood.carbs * ratio),
            fat_g: Math.round(dbFood.fat * ratio),
            source: "tzameret" as const,
          };
        } catch {
          return item; // silent fallback — never break the scan
        }
      })
    );
    const tzameretFinishedAt = Date.now();

    const totalCalories = enriched.reduce((sum: number, item: { calories: number }) => sum + item.calories, 0);

    console.log(
      `analyze-food timing: total=${Date.now() - timingStartedAt}ms parse=${parseFinishedAt - timingStartedAt}ms ai=${aiFinishedAt - aiStartedAt}ms tzameret=${tzameretFinishedAt - tzameretStartedAt}ms size=${sizeKB}KB items=${enriched.length} compression=${clientCompression}`
    );

    return NextResponse.json({
      items: enriched,
      total_calories: Math.round(totalCalories),
      photo_url: "",
      notes: "",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("analyze-food error:", msg);
    return NextResponse.json({ error: "אירעה שגיאה בניתוח התמונה. נסה שוב מאוחר יותר." }, { status: 500 });
  }
}
