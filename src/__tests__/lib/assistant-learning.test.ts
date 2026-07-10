import {
  buildPreferenceSummary,
  parsePreferenceProfile,
  updatePreferenceProfile,
} from "@/lib/assistant-learning";

describe("assistant learning", () => {
  it("turns positive feedback into reusable preference signals", () => {
    const profile = updatePreferenceProfile(
      parsePreferenceProfile(null),
      "liked",
      "לך על קוטג' עם פריכיות בערב, זה פתרון קצר וזול.",
    );

    expect(profile.likedFoods).toContain("קוטג'");
    expect(profile.likedFoods).toContain("פריכיות");
    expect(profile.situations).toContain("צריך פתרונות לערב");
    expect(profile.priceSensitivity).toContain("רגיש למחיר ומעדיף פתרונות זולים");
  });

  it("builds a compact summary for the assistant prompt", () => {
    const summary = buildPreferenceSummary({
      likedNotes: [],
      dislikedNotes: [],
      savedNotes: [],
      feedbackCount: 1,
      profile: {
        likedFoods: ["טונה"],
        dislikedFoods: [],
        savedIdeas: [],
        situations: ["צריך בחירות בסופר"],
        responseStyle: ["אוהב תשובות קצרות וישירות"],
        priceSensitivity: [],
      },
    });

    expect(summary).toContain("טונה");
    expect(summary).toContain("צריך בחירות בסופר");
    expect(summary).toContain("אוהב תשובות קצרות");
  });
});
