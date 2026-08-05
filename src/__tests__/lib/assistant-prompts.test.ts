import { SYSTEM_PROMPT } from "@/lib/assistant";
import { ASSISTANT_RESPONSE_PLAYBOOK } from "@/lib/assistant-brain";

jest.mock("@anthropic-ai/sdk", () => ({ __esModule: true, default: jest.fn() }));

describe("assistant nutrition and language guardrails", () => {
  it("forbids zero-calorie claims for real foods", () => {
    expect(ASSISTANT_RESPONSE_PLAYBOOK).toContain("אפס קלוריות");
    expect(ASSISTANT_RESPONSE_PLAYBOOK).toContain("קוטג'");
    expect(ASSISTANT_RESPONSE_PLAYBOOK).toContain("פריכיות");
    expect(ASSISTANT_RESPONSE_PLAYBOOK).toContain("ביצים");
  });

  it("requires exact quantities before promising a calorie ceiling", () => {
    expect(ASSISTANT_RESPONSE_PLAYBOOK).toContain("200 או 300 קלוריות");
    expect(ASSISTANT_RESPONSE_PLAYBOOK).toContain("כמות מדויקת");
    expect(ASSISTANT_RESPONSE_PLAYBOOK).toContain("טווח זהיר");
  });

  it("contains explicit consistent-gender examples", () => {
    expect(SYSTEM_PROMPT).toContain("תרגיש שבעה");
    expect(SYSTEM_PROMPT).toContain("תרגיש שובע");
    expect(SYSTEM_PROMPT).toContain("תרגישי שובע");
  });
});
