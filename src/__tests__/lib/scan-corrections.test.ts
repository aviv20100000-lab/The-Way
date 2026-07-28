import { diffScanItems } from "@/lib/scan-corrections";

const item = (name: string, grams: number, calories: number) => ({
  name,
  estimated_weight_g: grams,
  calories,
});

describe("diffScanItems", () => {
  it("reports nothing when the trainee saved the scan as-is", () => {
    const items = [item("חביתה", 120, 210), item("לחם", 60, 160)];
    expect(diffScanItems(items, items)).toEqual([]);
  });

  it("ignores small portion nudges but catches real ones", () => {
    const ai = [item("אורז", 200, 260)];
    expect(diffScanItems(ai, [item("אורז", 210, 268)])).toEqual([]);
    const corrections = diffScanItems(ai, [item("אורז", 320, 416)]);
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({ kind: "edited", ai_grams: 200, final_grams: 320 });
  });

  it("catches a rename in place — the signal that the scan misidentified a food", () => {
    const corrections = diffScanItems([item("גבינה צהובה", 100, 350)], [item("סלמון", 100, 350)]);
    expect(corrections).toEqual([
      expect.objectContaining({ kind: "renamed", ai_name: "גבינה צהובה", final_name: "סלמון" }),
    ]);
  });

  it("separates a hallucinated food from one the scan missed", () => {
    const corrections = diffScanItems(
      [item("חביתה", 120, 210), item("שמן זית", 10, 90)],
      [item("חביתה", 120, 210), item("קוטג'", 100, 100)]
    );
    // Positional pass pairs the leftovers, so this reads as one rename, not
    // an add plus a remove — which is the truth: row two was corrected.
    expect(corrections).toEqual([
      expect.objectContaining({ kind: "renamed", ai_name: "שמן זית", final_name: "קוטג'" }),
    ]);
  });

  it("flags an extra food the scan never proposed", () => {
    const corrections = diffScanItems([item("חביתה", 120, 210)], [item("חביתה", 120, 210), item("אבוקדו", 80, 130)]);
    expect(corrections).toEqual([
      expect.objectContaining({ kind: "added", ai_name: null, final_name: "אבוקדו" }),
    ]);
  });

  it("flags a food the trainee deleted", () => {
    const corrections = diffScanItems([item("חביתה", 120, 210), item("שמן", 10, 90)], [item("חביתה", 120, 210)]);
    expect(corrections).toEqual([
      expect.objectContaining({ kind: "removed", ai_name: "שמן", final_name: null }),
    ]);
  });

  it("matches by name regardless of order or spacing", () => {
    const corrections = diffScanItems(
      [item("לחם", 60, 160), item("חביתה", 120, 210)],
      [item("  חביתה ", 120, 210), item("לחם", 60, 160)]
    );
    expect(corrections).toEqual([]);
  });

  it("ignores blank rows the trainee added but never filled in", () => {
    const corrections = diffScanItems([item("חביתה", 120, 210)], [item("חביתה", 120, 210), item("", 100, 0)]);
    expect(corrections).toEqual([]);
  });
});
