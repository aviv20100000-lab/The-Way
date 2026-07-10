import { buildContextBlock, ASSISTANT_MAX_INPUT_CHARS, type AssistantUserContext } from "@/lib/assistant-context";

const baseContext: AssistantUserContext = {
  name: "דני",
  dailyCalories: 1800,
  dailyProteinG: 140,
  todayCalories: 1200,
  latestWeightKg: 92.5,
  targetWeightKg: 85,
};

describe("buildContextBlock", () => {
  it("includes goals, consumed calories, and remaining budget", () => {
    const block = buildContextBlock(baseContext);
    expect(block).toContain("דני");
    expect(block).toContain("1800");
    expect(block).toContain("1200");
    expect(block).toContain("נשארו: 600");
    expect(block).toContain("140");
    expect(block).toContain("92.5");
    expect(block).toContain("85");
  });

  it("never reports negative remaining calories", () => {
    const block = buildContextBlock({ ...baseContext, todayCalories: 2500 });
    expect(block).toContain("נשארו: 0");
  });

  it("suggests setting a goal when no calorie goal exists", () => {
    const block = buildContextBlock({
      ...baseContext,
      dailyCalories: null,
      dailyProteinG: null,
      latestWeightKg: null,
      targetWeightKg: null,
    });
    expect(block).toContain("אין יעד קלוריות מוגדר");
    expect(block).not.toContain("משקל אחרון");
    expect(block).not.toContain("יעד חלבון");
  });
  it("includes learned preference summary when available", () => {
    const block = buildContextBlock({
      ...baseContext,
      preferenceSummary: "המתאמן אהב בעבר: קוטג' ופריכיות",
    });
    expect(block).toContain("מה הבוט למד");
    expect(block).toContain("קוטג'");
  });
});

describe("assistant limits", () => {
  it("caps input at 500 characters", () => {
    expect(ASSISTANT_MAX_INPUT_CHARS).toBe(500);
  });
});
