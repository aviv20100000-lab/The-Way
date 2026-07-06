/** @jest-environment node */

import { NextRequest } from "next/server";
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

describe("GET /api/coach/meals", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects a client account", async () => {
    mockSession.mockResolvedValue({ id: "client-1", role: "client", name: "נועה", email: "noa@example.com", coach_id: "coach-1" });
    const { GET } = await import("@/app/api/coach/meals/route");
    const response = await GET(new NextRequest("http://localhost/api/coach/meals"));
    expect(response.status).toBe(403);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns photographed and quick meals with a stable client id", async () => {
    mockSession.mockResolvedValue({ id: "coach-1", role: "coach", name: "מאמן", email: "coach@example.com", coach_id: null });
    mockExecute
      .mockResolvedValueOnce({
        rows: [{
          id: "ai-1", client_id: "client-1", client_name: "נועה", client_avatar_url: null,
          total_calories: 410, logged_at: "2026-07-06T09:00:00Z", photo_url: "https://example.com/meal.jpg",
          ai_response: JSON.stringify({ items: [{ name: "סלט", calories: 410 }] }),
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "quick-1", client_id: "client-1", client_name: "נועה", client_avatar_url: null,
          total_calories: 220, logged_at: "2026-07-06T10:00:00Z", items_raw: "יוגורט:220:200:18",
        }],
      });

    const { GET } = await import("@/app/api/coach/meals/route");
    const response = await GET(new NextRequest("http://localhost/api/coach/meals?clientId=client-1&days=35"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body.map((meal: { source: string }) => meal.source)).toEqual(["quick", "ai"]);
    expect(body.every((meal: { client_id: string }) => meal.client_id === "client-1")).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockExecute.mock.calls[0][0].args).toEqual(["coach-1", "-35 days", "client-1"]);
  });
});
