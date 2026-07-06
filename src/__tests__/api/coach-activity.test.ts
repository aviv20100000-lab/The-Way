/** @jest-environment node */

import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

jest.mock("@/lib/auth", () => ({ getSessionUser: jest.fn() }));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(), batch: jest.fn() },
  initDb: jest.fn().mockResolvedValue(undefined),
}));

const mockSession = getSessionUser as jest.MockedFunction<typeof getSessionUser>;
const mockExecute = db.execute as jest.Mock;
const mockBatch = db.batch as jest.Mock;

describe("/api/coach/activity", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects non-coach accounts", async () => {
    mockSession.mockResolvedValue({ id: "client-1", role: "client", name: "נועה", email: "noa@example.com", coach_id: "coach-1" });
    const { GET } = await import("@/app/api/coach/activity/route");
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns only the coach activity and calculates unread items", async () => {
    mockSession.mockResolvedValue({ id: "coach-1", role: "coach", name: "מאמן", email: "coach@example.com", coach_id: null });
    mockExecute
      .mockResolvedValueOnce({ rows: [
        { activity_id: "weight:w1", client_id: "client-1", client_name: "נועה", kind: "weight", value: 64.2, logged_at: "2026-07-06 09:00:00" },
        { activity_id: "steps:s1", client_id: "client-2", client_name: "דני", kind: "steps", value: 8421, logged_at: "2026-07-05 18:00:00" },
      ] })
      .mockResolvedValueOnce({ rows: [{ activity_id: "steps:s1" }] });

    const { GET } = await import("@/app/api/coach/activity/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.unread_count).toBe(1);
    expect(body.items[0]).toMatchObject({ client_id: "client-1", title: "עדכן משקל", unread: true });
    expect(mockExecute.mock.calls[0][0].args).toEqual(["coach-1", "coach-1", "coach-1", "coach-1"]);
  });

  it("marks activity as seen for the logged-in coach", async () => {
    mockSession.mockResolvedValue({ id: "coach-1", role: "coach", name: "מאמן", email: "coach@example.com", coach_id: null });
    mockBatch.mockResolvedValueOnce([]);
    const { POST } = await import("@/app/api/coach/activity/route");
    const response = await POST(new NextRequest("http://localhost/api/coach/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityIds: ["weight:w1"] }),
    }));
    expect(response.status).toBe(200);
    expect(mockBatch.mock.calls[0][0][0].args).toEqual(["coach-1", "weight:w1"]);
  });
});
