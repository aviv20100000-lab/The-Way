/** @jest-environment node */

import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("client steps goal display contract", () => {
  const source = readFileSync(join(process.cwd(), "src/app/client/page.tsx"), "utf8");

  it("does not calculate progress or show a target when the real goal is missing", () => {
    expect(source).toContain("const stepsPct = goalStatus.steps && stepsGoal > 0");
    expect(source).toContain("היעד עדיין לא הוגדר");
    expect(source).toContain("היעד היומי עדיין לא הוגדר");
  });
});
