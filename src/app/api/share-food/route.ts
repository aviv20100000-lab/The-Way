import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { analyzeFoodPhotoBase64 } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const formData = await req.formData();
  const photo = formData.get("photo") as File | null;
  if (!photo) return NextResponse.redirect(new URL("/?tab=food", req.url));

  const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!validMimeTypes.includes(photo.type)) {
    return NextResponse.redirect(new URL("/?tab=food&error=invalid_image", req.url));
  }

  try {
    const buffer = Buffer.from(await photo.arrayBuffer());

    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.redirect(new URL("/?tab=food&error=file_too_large", req.url));
    }

    const base64 = buffer.toString("base64");
    const analysis = await analyzeFoodPhotoBase64(base64, photo.type);

    const items = Array.isArray(analysis) ? analysis : (analysis.items ?? []);
    const totalCalories = items.reduce(
      (sum: number, item: { calories?: number }) => sum + (item.calories || 0),
      0
    );

    const result = {
      items: items.map((item: any) => ({
        name: item.name_he || item.name,
        estimated_weight_g: item.estimated_weight_g || 100,
        calories: item.calories || 0,
        protein_g: item.protein || 0,
        carbs_g: item.carbs || 0,
        fat_g: item.fat || 0,
      })),
      total_calories: Math.round(totalCalories),
      photo_url: "",
      notes: "",
    };

    const res = NextResponse.redirect(new URL("/?tab=food", req.url));
    res.cookies.set("shared_food_result", JSON.stringify(result), {
      maxAge: 120,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    return res;
  } catch {
    return NextResponse.redirect(new URL("/?tab=food", req.url));
  }
}
