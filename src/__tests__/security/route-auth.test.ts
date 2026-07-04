/**
 * @jest-environment node
 *
 * Tests that protected API routes reject unauthenticated requests with 401.
 * Mocks getSessionUser to return null (unauthenticated).
 * Does not hit the DB or external services.
 */

import { NextRequest } from "next/server";

// ── shared mocks ──────────────────────────────────────────────────────────────

jest.mock("@/lib/auth", () => ({
  getSessionUser: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn().mockResolvedValue({ rows: [] }) },
  initDb: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/ratelimit", () => ({
  checkPersistentRateLimit: jest
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 99, resetIn: 60000 }),
  checkRateLimit: jest
    .fn()
    .mockReturnValue({ allowed: true, remaining: 99, resetIn: 60000 }),
}));

jest.mock("@/lib/seed", () => ({
  ensureSeed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/meals", () => ({
  getMealsByUser: jest.fn().mockResolvedValue([]),
  getMealsForCoach: jest.fn().mockResolvedValue([]),
  createMeal: jest.fn().mockResolvedValue({}),
}));

jest.mock("@/lib/security-alerts", () => ({
  sendSecurityAlert: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/anthropic", () => ({
  extractStepsFromScreenshotBase64: jest.fn(),
}));

// web-push is used in chat/messages
jest.mock("web-push", () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue(undefined),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function get(path: string) {
  return new NextRequest(`http://localhost${path}`, { method: "GET" });
}

function post(path: string, body: unknown = {}) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("Protected routes — reject unauthenticated requests with 401", () => {
  it("GET /api/health/water → 401", async () => {
    const { GET } = await import("@/app/api/health/water/route");
    const res = await GET(get("/api/health/water"));
    expect(res.status).toBe(401);
  });

  it("GET /api/health/steps → 401", async () => {
    const { GET } = await import("@/app/api/health/steps/route");
    const res = await GET(get("/api/health/steps"));
    expect(res.status).toBe(401);
  });

  it("GET /api/foods/meals → 401", async () => {
    const { GET } = await import("@/app/api/foods/meals/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET /api/chat/messages → 401", async () => {
    const { GET } = await import("@/app/api/chat/messages/route");
    const res = await GET(get("/api/chat/messages"));
    expect(res.status).toBe(401);
  });

  it("GET /api/chat/contacts → 401", async () => {
    const { GET } = await import("@/app/api/chat/contacts/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("POST /api/foods/analyze → 401", async () => {
    const { POST } = await import("@/app/api/foods/analyze/route");
    const res = await POST(post("/api/foods/analyze"));
    expect(res.status).toBe(401);
  });
});
