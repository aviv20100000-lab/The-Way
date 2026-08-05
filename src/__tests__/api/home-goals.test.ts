/** @jest-environment node */

import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

jest.mock("@/lib/auth", () => ({ getSessionUser: jest.fn() }));
jest.mock("@/lib/daily-summary", () => ({
  getTodayDayKey: jest.fn(() => "2026-08-05"),
  getDayRangeUtc: jest.fn(() => ({ startUtc: "2026-08-04T21:00:00Z", endUtc: "2026-08-05T21:00:00Z" })),
}));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn().mockResolvedValue(undefined),
}));

const mockSession = getSessionUser as jest.MockedFunction<typeof getSessionUser>;
const mockExecute = db.execute as jest.Mock;

function arrangeHomeQueries(menuGoal: number | null, generalGoal: number | null = 2100) {
  mockExecute.mockImplementation((statement: string | { sql: string }) => {
    const sql = typeof statement === "string" ? statement : statement.sql;
    if (sql.includes("FROM quotes")) return Promise.resolve({ rows: [] });
    if (sql.includes("FROM water_logs")) return Promise.resolve({ rows: [] });
    if (sql.includes("FROM goals")) return Promise.resolve({ rows: [{ daily_calories: generalGoal, daily_steps: null }] });
    if (sql.includes("FROM water_streak")) return Promise.resolve({ rows: [] });
    if (sql.includes("FROM steps_logs") && sql.includes("total_steps")) return Promise.resolve({ rows: [{ total_steps: 0 }] });
    if (sql.includes("FROM steps_logs")) return Promise.resolve({ rows: [{ steps: 0 }] });
    if (sql.includes("AS total_calories")) return Promise.resolve({ rows: [{ total_calories: 0 }] });
    if (sql.includes("SELECT created_at FROM users")) return Promise.resolve({ rows: [{ created_at: "2026-08-01 12:00:00" }] });
    if (sql.includes("FROM menu_plans")) return Promise.resolve({ rows: menuGoal === null ? [] : [{ daily_calories_target: menuGoal }] });
    throw new Error(`Unexpected SQL: ${sql}`);
  });
}

describe("GET /api/home calorie goal priority", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ id: "client-1", role: "client", name: "אביב בדיקה", email: "test@example.com", coach_id: "coach-1" });
  });

  it("uses the published menu target instead of the general goal", async () => {
    arrangeHomeQueries(1750);
    const { GET } = await import("@/app/api/home/route");
    const response = await GET();
    const body = await response.json();

    expect(body.calories.goal).toBe(1750);
    expect(body.calorie_goal_source).toBe("menu");
    expect(body.goal_status.calories).toBe(true);
  });

  it("falls back to the general goal when no published menu target exists", async () => {
    arrangeHomeQueries(null, 2100);
    const { GET } = await import("@/app/api/home/route");
    const response = await GET();
    const body = await response.json();

    expect(body.calories.goal).toBe(2100);
    expect(body.calorie_goal_source).toBe("general");
    expect(body.goal_status.calories).toBe(true);
  });
});
