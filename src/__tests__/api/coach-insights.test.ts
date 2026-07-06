/** @jest-environment node */

import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

jest.mock("@/lib/auth", () => ({ getSessionUser: jest.fn() }));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn().mockResolvedValue(undefined),
}));

const mockSession = getSessionUser as jest.MockedFunction<typeof getSessionUser>;
const mockExecute = db.execute as jest.Mock;

describe("GET /api/coach/insights", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects client accounts", async () => {
    mockSession.mockResolvedValue({ id: "client-1", role: "client", name: "נועה", email: "noa@example.com", coach_id: "coach-1" });
    const { GET } = await import("@/app/api/coach/insights/route");
    expect((await GET()).status).toBe(403);
  });

  it("scopes every dataset to the signed-in coach and disables caching", async () => {
    mockSession.mockResolvedValue({ id: "coach-1", role: "coach", name: "מאמן", email: "coach@example.com", coach_id: null });
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: "client-1", name: "נועה", avatar_url: null, created_at: "2026-01-01 00:00:00", daily_calories: 1800, daily_protein_g: 100, daily_steps: 8000, target_weight_kg: 65, weigh_in_frequency_weeks: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { GET } = await import("@/app/api/coach/insights/route");
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body.clients[0].id).toBe("client-1");
    expect(mockExecute).toHaveBeenCalledTimes(5);
    for (const [statement] of mockExecute.mock.calls) expect(statement.args).toEqual(["coach-1"]);
  });
});
