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

  it("lays out today's coach menu with what is still unmarked", () => {
    const block = buildContextBlock({
      ...baseContext,
      todayMenuDayName: "שני",
      todayMenu: [
        {
          label: "בוקר",
          status: "planned",
          options: [{ label: "אפשרות א׳", calories: 420, items: ["חביתה 100 ג׳", "לחם 60 ג׳"] }],
        },
        {
          label: "צהריים",
          status: null,
          options: [
            { label: "אפשרות א׳", calories: 600, items: ["חזה עוף 150 ג׳"] },
            { label: "אפשרות ב׳", calories: 580, items: ["טונה 120 ג׳"] },
          ],
        },
        { label: "ערב", status: "other", options: [{ label: "אפשרות א׳", calories: 500, items: ["סלט 200 ג׳"] }] },
      ],
    });
    expect(block).toContain("התפריט שהמאמן בנה לו לשני");
    expect(block).toContain("בוקר — כבר אכל");
    expect(block).toContain("צהריים — עדיין לא סימן");
    expect(block).toContain("ערב — אכל משהו אחר");
    expect(block).toContain("אפשרות ב׳ (580 קל'): טונה 120 ג׳");
    expect(block).toContain("אל תמציא מזון");
  });

  it("says nothing about a menu when the client has none", () => {
    const block = buildContextBlock({ ...baseContext, todayMenu: null });
    expect(block).not.toContain("התפריט שהמאמן בנה");
    expect(block).not.toContain("אל תמציא מזון");
  });
});

describe("assistant limits", () => {
  it("caps input at 500 characters", () => {
    expect(ASSISTANT_MAX_INPUT_CHARS).toBe(500);
  });
});
