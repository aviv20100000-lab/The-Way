import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { searchFoods } from "@/lib/meals";
import { ensureSeed } from "@/lib/seed";
import db from "@/lib/db";

// Official MoH Tzameret DB — searched first, shortest (most generic) names win
async function searchTzameret(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const escaped = trimmed.replace(/[\\%_]/g, (c) => `\\${c}`);
  const res = await db.execute({
    sql: `SELECT code, name_he, calories, protein, carbs, fat FROM tzameret_foods
          WHERE name_he LIKE ? ESCAPE '\\' AND name_he NOT LIKE 'FFQ%'
          ORDER BY length(name_he) ASC, code ASC LIMIT 12`,
    args: [`%${escaped}%`],
  });
  return res.rows.map((r) => ({
    id: `tz-${r.code}`,
    name_he: String(r.name_he),
    name_en: null,
    calories: Math.round(Number(r.calories) || 0),
    protein: Number(r.protein) || 0,
    carbs: Number(r.carbs) || 0,
    fat: Number(r.fat) || 0,
    serving_size: "100g",
  }));
}

async function searchOpenFoodFacts(query: string) {
  try {
    const url = `https://il.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,product_name_he,nutriments,serving_size`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const products = Array.isArray(data.products) ? data.products : [];
    return products
      .filter((p: Record<string, unknown>) => p.product_name_he || p.product_name)
      .map((p: Record<string, unknown>) => {
        const n = (p.nutriments ?? {}) as Record<string, number>;
        const cal = n["energy-kcal_100g"] ?? Math.round((n["energy_100g"] ?? 0) / 4.184);
        return {
          id: `off-${Math.random().toString(36).slice(2)}`,
          name_he: (p.product_name_he as string) || (p.product_name as string) || "",
          name_en: null,
          calories: Math.round(cal) || 0,
          protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
          carbs:   Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
          fat:     Math.round((n.fat_100g ?? 0) * 10) / 10,
          serving_size: "100g",
        };
      })
      .filter((f: { calories: number }) => f.calories > 0);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  await ensureSeed();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q") || "";

  const [tzameret, local] = await Promise.all([searchTzameret(q), searchFoods(q)]);

  const seen = new Set(tzameret.map((f) => f.name_he));
  const merged = [...tzameret, ...local.filter((f: { name_he: string }) => !seen.has(f.name_he))];
  if (merged.length >= 3) return NextResponse.json(merged.slice(0, 15));

  // Supplement with Open Food Facts only when both DBs came up short
  const off = await searchOpenFoodFacts(q);
  for (const f of merged) seen.add(f.name_he);
  const withOff = [...merged, ...off.filter((f: { name_he: string }) => !seen.has(f.name_he))];
  return NextResponse.json(withOff.slice(0, 15));
}
