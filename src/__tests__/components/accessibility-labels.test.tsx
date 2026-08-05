import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WaterActionButtons } from "@/components/WaterActionButtons";

describe("trainee accessibility labels", () => {
  it("exposes the custom water amount by an accessible name", () => {
    render(<WaterActionButtons onAddWater={jest.fn().mockResolvedValue(true)} />);
    fireEvent.click(screen.getByRole("button", { name: /מותאם/ }));
    expect(screen.getByLabelText("כמות מים מותאמת במ״ל").getAttribute("type")).toBe("number");
  });

  it("keeps accessible names on icon-only chat and meal fields", () => {
    const root = process.cwd();
    const chatSource = readFileSync(join(root, "src/app/chat/page.tsx"), "utf8");
    const mealSource = readFileSync(join(root, "src/components/MealScanner.tsx"), "utf8");
    const menuSource = readFileSync(join(root, "src/components/ClientMenuView.tsx"), "utf8");

    expect(chatSource).toContain('aria-label="שלח הודעה"');
    expect(chatSource).toContain('"חזרה לרשימת השיחות"');
    expect(mealSource).toContain('aria-label="כמות בגרם"');
    expect(mealSource).toContain('aria-label="קלוריות"');
    expect(menuSource).toContain('aria-label="טוען את התפריט"');
  });
});
