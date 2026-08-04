import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  analyzeFoodPhotoBase64,
  isAnthropicImageMediaType,
  MAX_ANTHROPIC_IMAGE_BYTES,
} from "@/lib/anthropic";
import { checkPersistentRateLimit, formatResetIn, refundPersistentRateLimit } from "@/lib/ratelimit";
import { matchTzameret } from "@/lib/tzameret";

const TZAMERET_TIMEOUT_MS = 2500;

// Aviv is the developer account used to test and tune the scanner, so it has no
// daily scan cap. Matched on both username and display name so it holds however the
// account is spelled. Every other user keeps the normal three scans per day.
const UNLIMITED_SCAN_USERS = ["aviv", "אביב"];

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout?: () => void): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => {
      onTimeout?.();
      resolve(null);
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export async function POST(req: NextRequest) {
  const timingStartedAt = Date.now();
  // Set once the daily quota has actually been spent. Every path that returns
  // without a real analysis gives it back: a rejected file or a model outage must
  // not cost the trainee one of their three scans for the day.
  let consumedQuotaKey: string | null = null;
  const failed = async (body: Record<string, unknown>, status: number) => {
    if (consumedQuotaKey) {
      await refundPersistentRateLimit(consumedQuotaKey);
      consumedQuotaKey = null;
    }
    return NextResponse.json(body, { status });
  };

  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    const skipScanQuota = UNLIMITED_SCAN_USERS.includes((user.username ?? "").trim().toLowerCase())
      || UNLIMITED_SCAN_USERS.includes((user.name ?? "").trim().toLowerCase());
    if (!skipScanQuota) {
      const rateLimit = await checkPersistentRateLimit(`foods-analyze:${user.id}`, "mealScan");
      if (!rateLimit.allowed) {
        // Not a dead end: the manual quick-logger sits right below the scanner, so
        // point there instead of telling the trainee to come back tomorrow.
        return NextResponse.json(
          {
            error: `נגמרו לך הסריקות להיום. אפשר להוסיף את הארוחה ידנית ברישום המהיר שמתחת 👇 (הסריקות מתחדשות בעוד ${formatResetIn(rateLimit.resetIn)})`,
            limit_reached: true,
          },
          { status: 429 }
        );
      }
      // A denied request never incremented the counter, so only mark the quota spent
      // once the check has passed. An exempt tester never consumes quota, so there is
      // nothing to refund for them either.
      consumedQuotaKey = `foods-analyze:${user.id}`;
    }

    const formData = await req.formData();
    const photo = formData.get("photo");
    const compressionField = formData.get("client_compression");
    const clientCompression = compressionField === "ok" || compressionField === "fallback"
      ? compressionField
      : "unknown";

    if (!(photo instanceof File)) {
      return failed({ error: "צריך להעלות תמונה" }, 400);
    }

    if (!isAnthropicImageMediaType(photo.type)) {
      return failed({ error: "רק קבצי תמונה מותרים (JPEG, PNG, WebP, GIF)" }, 400);
    }

    const buffer = Buffer.from(await photo.arrayBuffer());
    const parseFinishedAt = Date.now();
    const sizeKB = Math.round(buffer.length / 1024);

    if (buffer.length === 0) {
      return failed({ error: "התמונה ריקה" }, 400);
    }

    if (buffer.length > MAX_ANTHROPIC_IMAGE_BYTES) {
      return failed({ error: "התמונה גדולה מדי (מקסימום 7.5MB)" }, 413);
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
    let timeoutCount = 0;
    let rejectedCount = 0;
    const enriched = await Promise.all(
      mapped.map(async (item: typeof mapped[number]) => {
        if (!item.name) return item;
        try {
          const dbFood = await withTimeout(
            matchTzameret(item.name),
            TZAMERET_TIMEOUT_MS,
            () => { timeoutCount += 1; }
          );
          if (!dbFood) return item;
          // A contains match can return an unrelated food. If its calorie density
          // is too far from the model estimate, keep the model values instead.
          const ratio = item.estimated_weight_g / 100;
          const modelPer100g = ratio > 0 ? item.calories / ratio : 0;
          if (modelPer100g > 0 && dbFood.calories > 0) {
            const factor = dbFood.calories / modelPer100g;
            if (factor > 1.8 || factor < 0.55) {
              rejectedCount += 1;
              return item;
            }
          }
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
      `analyze-food timing: total=${Date.now() - timingStartedAt}ms parse=${parseFinishedAt - timingStartedAt}ms ai=${aiFinishedAt - aiStartedAt}ms tzameret=${tzameretFinishedAt - tzameretStartedAt}ms size=${sizeKB}KB items=${enriched.length} compression=${clientCompression} tzameretTimeouts=${timeoutCount} tzameretRejected=${rejectedCount}`
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
    return failed({ error: "אירעה שגיאה בניתוח התמונה. נסה שוב מאוחר יותר." }, 500);
  }
}
