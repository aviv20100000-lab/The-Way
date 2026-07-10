import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  analyzeFoodPhotoBase64,
  isAnthropicImageMediaType,
  MAX_ANTHROPIC_IMAGE_BYTES,
} from "@/lib/anthropic";
import { searchFoods } from "@/lib/meals";
import type { Food } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

    const formData = await req.formData();
    const photo = formData.get("photo");

    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "צריך להעלות תמונה" }, { status: 400 });
    }

    if (!isAnthropicImageMediaType(photo.type)) {
      return NextResponse.json({ error: "רק קבצי תמונה מותרים (JPEG, PNG, WebP, GIF)" }, { status: 400 });
    }

    const buffer = Buffer.from(await photo.arrayBuffer());
    const sizeKB = Math.round(buffer.length / 1024);

    if (buffer.length === 0) {
      return NextResponse.json({ error: "התמונה ריקה" }, { status: 400 });
    }

    if (buffer.length > MAX_ANTHROPIC_IMAGE_BYTES) {
      return NextResponse.json({ error: "התמונה גדולה מדי (מקסימום 7.5MB)" }, { status: 413 });
    }

    console.log(`analyze-food: received ${sizeKB}KB, type=${photo.type}`);

    const base64 = buffer.toString("base64");
    const analysis = await analyzeFoodPhotoBase64(base64, photo.type);

    const raw = Array.isArray(analysis) ? analysis : (analysis.items ?? []);

    // Filter: keep items where confidence is explicitly >= 0.6, or undefined (model didn't score)
    const confident = raw.filter((item: Record<string, unknown>) => {
      const conf = item.confidence;
      return typeof conf !== "number" || conf >= 0.6;
    });

    // Map + macro validation
    const mapped = confident.map((item: Record<string, unknown>) => {
      const protein_g = Number(item.protein) || 0;
      const carbs_g   = Number(item.carbs)   || 0;
      const fat_g     = Number(item.fat)      || 0;
      const reported  = Number(item.calories) || 0;

      // If macros diverge >15% from reported calories, trust the macro math
      const calcCals = Math.round(protein_g * 4 + carbs_g * 4 + fat_g * 9);
      const variance = calcCals > 0
        ? Math.abs(calcCals - reported) / Math.max(reported, 1)
        : 0;
      const calories = Math.max(1, variance > 0.15 && calcCals > 0 ? calcCals : reported);

      return {
        name: String(item.name_he || item.name || ""),
        estimated_weight_g: Number(item.estimated_weight_g) || 100,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        confidence: typeof item.confidence === "number" ? item.confidence : 1,
      };
    });

    // RAG: enrich with DB calories when we find a confident name match
    const enriched = await Promise.all(
      mapped.map(async (item: typeof mapped[number]) => {
        if (!item.name) return item;
        try {
          const results = await searchFoods(item.name);
          if (results.length === 0) return item;
          const dbFood: Food = results[0];
          const aiName = item.name.toLowerCase().trim();
          const dbName = (dbFood.name_he || "").toLowerCase().trim();
          // Only substitute if names meaningfully overlap
          const isMatch = aiName.includes(dbName) || dbName.includes(aiName.split(" ")[0]);
          if (!isMatch || dbFood.calories <= 0) return item;
          const ratio = item.estimated_weight_g / 100;
          return {
            ...item,
            calories:   Math.max(1, Math.round(dbFood.calories * ratio)),
            protein_g:  Math.round(dbFood.protein  * ratio * 10) / 10,
            carbs_g:    Math.round(dbFood.carbs     * ratio * 10) / 10,
            fat_g:      Math.round(dbFood.fat       * ratio * 10) / 10,
          };
        } catch {
          return item; // silent fallback — never break the scan
        }
      })
    );

    const totalCalories = enriched.reduce((sum: number, item: { calories: number }) => sum + item.calories, 0);

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
