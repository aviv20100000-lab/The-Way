/**
 * @jest-environment node
 *
 * Tests that GET /api/admin/audit-log enforces coach-only access
 * and returns the expected response shape.
 */

import { NextRequest } from "next/server";

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockGetSessionUser = jest.fn();

jest.mock("@/lib/auth", () => ({
  getSessionUser: mockGetSessionUser,
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn().mockResolvedValue({
      rows: [
        { id: "1", event: "password_reset_success", user_id: "u1", ip: "1.2.3.***", metadata: null, created_at: "2026-06-30T10:00:00" },
      ],
    }),
  },
  initDb: jest.fn().mockResolvedValue(undefined),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function get(qs = "") {
  return new NextRequest(`http://localhost/api/admin/audit-log${qs}`, { method: "GET" });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/admin/audit-log — access control", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetSessionUser.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/admin/audit-log/route");
    const res = await GET(get());
    expect(res.status).toBe(401);
  });

  it("returns 401 when caller is a client", async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: "c1", role: "client", name: "Alice" });
    const { GET } = await import("@/app/api/admin/audit-log/route");
    const res = await GET(get());
    expect(res.status).toBe(401);
  });

  it("returns 200 with entries array when caller is a coach", async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: "coach1", role: "coach", name: "Coach" });
    const { GET } = await import("@/app/api/admin/audit-log/route");
    const res = await GET(get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.entries)).toBe(true);
    expect(typeof body.count).toBe("number");
  });

  it("response entries do not contain password_hash or raw tokens", async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: "coach1", role: "coach", name: "Coach" });
    const { GET } = await import("@/app/api/admin/audit-log/route");
    const res = await GET(get());
    const body = await res.json();
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/password_hash/);
    expect(text).not.toMatch(/Bearer /);
  });
});
