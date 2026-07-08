/** @jest-environment node */

import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

jest.mock("@/lib/auth", () => ({ getSessionUser: jest.fn() }));
jest.mock("@/lib/anthropic", () => ({ extractStepsFromScreenshotBase64: jest.fn() }));
jest.mock("@/lib/ratelimit", () => ({
  checkPersistentRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  formatResetIn: jest.fn(),
}));
jest.mock("@/lib/daily-summary", () => ({
  getTodayDayKey: jest.fn(() => "2026-07-08"),
  getDayRangeUtc: jest.fn((day: string) => ({ startUtc: `${day} 00:00:00`, endUtc: `${day} 23:59:59` })),
}));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn().mockResolvedValue(undefined),
}));

const mockSession = getSessionUser as jest.MockedFunction<typeof getSessionUser>;
const mockExecute = db.execute as jest.Mock;

describe("/api/health/steps leaderboard", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns no competition for a client who is not in any group", async () => {
    mockSession.mockResolvedValue({ id: "client-1", role: "client", name: "נועה", email: "noa@example.com", coach_id: "coach-1" });
    mockExecute
      .mockResolvedValueOnce({ rows: [{ coach_id: "coach-1", role: "client", in_default_group: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const { GET } = await import("@/app/api/health/steps/route");
    const response = await GET(new NextRequest("http://localhost/api/health/steps?type=leaderboard"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ entries: [], hasCompetition: false, groupName: null });
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("limits a client leaderboard to members of their default group", async () => {
    mockSession.mockResolvedValue({ id: "client-1", role: "client", name: "נועה", email: "noa@example.com", coach_id: "coach-1" });
    mockExecute
      .mockResolvedValueOnce({ rows: [{ coach_id: "coach-1", role: "client", in_default_group: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "client-1", name: "נועה", today: 5000, week: 18000 }] });

    const { GET } = await import("@/app/api/health/steps/route");
    const response = await GET(new NextRequest("http://localhost/api/health/steps?type=leaderboard"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.hasCompetition).toBe(true);
    expect(body.groupName).toBe("הקבוצה הראשית");
    expect(body.entries).toHaveLength(1);
    expect(mockExecute.mock.calls[2][0].sql).toContain("u.in_default_group = 1");
  });
});
