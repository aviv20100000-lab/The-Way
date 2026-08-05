/** @jest-environment node */

import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

jest.mock("@/lib/auth", () => ({ getSessionUser: jest.fn() }));
jest.mock("@/lib/seed", () => ({ ensureSeed: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/meals", () => ({ searchFoods: jest.fn().mockResolvedValue([]) }));
jest.mock("@/lib/db", () => ({ __esModule: true, default: { execute: jest.fn() } }));

const mockSession = getSessionUser as jest.MockedFunction<typeof getSessionUser>;
const mockExecute = db.execute as jest.Mock;

describe("GET /api/foods relevance ordering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ id: "client-1", role: "client", name: "בדיקה", email: "test@example.com", coach_id: "coach-1" });
    mockExecute.mockResolvedValue({ rows: [
      { code: "1", name_he: "אורז לבן מבושל", calories: 130, protein: 2, carbs: 28, fat: 0 },
      { code: "2", name_he: "אורז מלא", calories: 120, protein: 3, carbs: 25, fat: 1 },
      { code: "3", name_he: "קמח אורז", calories: 360, protein: 6, carbs: 80, fat: 1 },
    ] });
  });

  it("prioritizes names that start with the search query", async () => {
    const { GET } = await import("@/app/api/foods/route");
    const response = await GET(new NextRequest("http://localhost/api/foods?q=אורז"));

    expect(response.status).toBe(200);
    expect(mockExecute.mock.calls[0][0].sql).toContain("CASE WHEN name_he LIKE");
    expect(mockExecute.mock.calls[0][0].args).toEqual(["%אורז%", "אורז%"]);
  });
});
