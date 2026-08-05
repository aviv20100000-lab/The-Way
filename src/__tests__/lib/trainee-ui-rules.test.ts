import { getLatestWeightLabel } from "@/components/WeightJourney";
import { isMealScannerItemValid } from "@/components/MealScanner";
import { formatHebrewCount } from "@/lib/hebrew-plural";

describe("trainee UI rules", () => {
  it("labels an old Jerusalem weight log as the latest measurement with its date", () => {
    expect(getLatestWeightLabel("2026-07-06T08:00:00Z", new Date("2026-07-07T08:00:00Z")))
      .toContain("מדידה אחרונה");
    expect(getLatestWeightLabel("2026-07-06T19:30:00Z", new Date("2026-07-06T20:30:00Z")))
      .toBe("היום");
  });

  it("rejects blank, zero-weight and non-numeric manual meal items", () => {
    expect(isMealScannerItemValid({ name: " ", estimated_weight_g: 100, calories: 0 })).toBe(false);
    expect(isMealScannerItemValid({ name: "סלט", estimated_weight_g: 0, calories: 0 })).toBe(false);
    expect(isMealScannerItemValid({ name: "סלט", estimated_weight_g: 100, calories: Number.NaN })).toBe(false);
    expect(isMealScannerItemValid({ name: "סלט", estimated_weight_g: 100, calories: 50 })).toBe(true);
  });

  it("formats singular and plural Hebrew counts", () => {
    expect(formatHebrewCount(1, { one: "ארוחה אחת", plural: "ארוחות" })).toBe("ארוחה אחת");
    expect(formatHebrewCount(2, { one: "ארוחה אחת", plural: "ארוחות" })).toBe("2 ארוחות");
    expect(formatHebrewCount(1, { one: "יום אחד ברצף", plural: "ימים ברצף" })).toBe("יום אחד ברצף");
  });
});
