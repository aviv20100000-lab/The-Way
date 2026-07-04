import { getMealTypeForIsraelTime } from "@/lib/meal-time";

describe("getMealTypeForIsraelTime", () => {
  it.each([
    ["2026-07-05T04:00:00Z", "breakfast"], // 07:00 Israel
    ["2026-07-05T08:00:00Z", "lunch"],     // 11:00 Israel
    ["2026-07-05T14:00:00Z", "dinner"],   // 17:00 Israel
    ["2026-07-04T22:00:00Z", "snack"],    // 01:00 Israel
  ])("classifies %s as %s", (timestamp, expected) => {
    expect(getMealTypeForIsraelTime(new Date(timestamp))).toBe(expected);
  });
});
