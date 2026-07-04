/**
 * @jest-environment node
 *
 * Tests that password reset tokens cannot be replayed.
 * Tests the reset-password route handler with mocked dependencies,
 * simulating: valid token, expired/missing token, and replayed token.
 */

import { NextRequest } from "next/server";

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockConsumeResetToken = jest.fn();

jest.mock("@/lib/password-reset", () => ({
  consumeResetToken: mockConsumeResetToken,
}));

jest.mock("@/lib/auth", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashed-pw"),
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
    .mockResolvedValue({ allowed: true, remaining: 9, resetIn: 60000 }),
}));

jest.mock("@/lib/security-alerts", () => ({
  sendSecurityAlert: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/validation", () => ({
  validatePassword: jest.fn().mockReturnValue({ valid: true }),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function postReset(body: unknown) {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("Reset-password route — token replay protection", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 200 when a valid unused token is submitted", async () => {
    mockConsumeResetToken.mockResolvedValueOnce({
      userId: "user-123",
      email: "test@example.com",
      jti: "abc",
      iat: 0,
      exp: 9999999999,
    });

    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(postReset({ token: "valid-token", password: "NewPass1!" }));
    expect(res.status).toBe(200);
  });

  it("returns 400 when token is expired or missing from DB (consumed)", async () => {
    // consumeResetToken returns null → token was already used or expired
    mockConsumeResetToken.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(postReset({ token: "expired-or-used-token", password: "NewPass1!" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 400 on replay — second call with same token is rejected", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");

    // First call: token is valid
    mockConsumeResetToken.mockResolvedValueOnce({
      userId: "user-456",
      email: "replay@example.com",
      jti: "xyz",
      iat: 0,
      exp: 9999999999,
    });
    const first = await POST(postReset({ token: "one-time-token", password: "NewPass1!" }));
    expect(first.status).toBe(200);

    // Second call: token already consumed → consumeResetToken returns null
    mockConsumeResetToken.mockResolvedValueOnce(null);
    const second = await POST(postReset({ token: "one-time-token", password: "NewPass1!" }));
    expect(second.status).toBe(400);
  });

  it("sends a security alert when an invalid/replayed token is submitted", async () => {
    const { sendSecurityAlert } = await import("@/lib/security-alerts");
    mockConsumeResetToken.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/auth/reset-password/route");
    await POST(postReset({ token: "bad-token", password: "NewPass1!" }));

    expect(sendSecurityAlert).toHaveBeenCalledWith(
      expect.objectContaining({ event: "reset_password_invalid_token" })
    );
  });

  it("returns 400 when token field is missing entirely", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(postReset({ password: "NewPass1!" }));
    expect(res.status).toBe(400);
    // consumeResetToken should not be called at all
    expect(mockConsumeResetToken).not.toHaveBeenCalled();
  });
});
