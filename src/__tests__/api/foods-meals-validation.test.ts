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
jest.mock("@/lib/blob-storage", () => ({ isOwnMealPhotoUrl: jest.fn(() => false) }));

const mockSession = getSessionUser as jest.MockedFunction<typeof getSessionUser>;
const mockExecute = db.execute as jest.Mock;

describe("POST /api/foods/meals validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ id: "client-1", role: "client", name: "בדיקה", email: "test@example.com", coach_id: "coach-1" });
  });

  it("rejects an item with a blank name", async () => {
    const { POST } = await import("@/app/api/foods/meals/route");
    const response = await POST(new NextRequest("http://localhost/api/foods/meals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ name: "   ", calories: 0, estimated_weight_g: 100 }] }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("אחד מפריטי הארוחה אינו תקין");
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
