/** @jest-environment node */

import { NextRequest } from "next/server";

const execute = jest.fn();
const sendTelegramAlert = jest.fn();
const checkPersistentRateLimit = jest.fn();

jest.mock("@/lib/auth", () => ({
  getSessionUser: jest.fn().mockResolvedValue({
    id: "user-1",
    name: "דני <בדיקה>",
    role: "client",
  }),
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args: unknown[]) => execute(...args) },
  initDb: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/ratelimit", () => ({
  checkPersistentRateLimit: (...args: unknown[]) => checkPersistentRateLimit(...args),
}));

jest.mock("@/lib/telegram", () => ({
  sendTelegramAlert: (...args: unknown[]) => sendTelegramAlert(...args),
}));

function request(message = "render failed") {
  return new NextRequest("http://localhost/api/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify({
      name: "TypeError",
      message,
      componentStack: "at ClientHome",
      path: "/client",
      userAgent: "iPhone test",
    }),
  });
}

describe("POST /api/client-errors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkPersistentRateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetIn: 1000 });
    execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    sendTelegramAlert.mockResolvedValue(true);
  });

  it("sends one escaped Telegram alert for a new client error", async () => {
    const { POST } = await import("@/app/api/client-errors/route");
    const response = await POST(request("bad <script>"));

    expect(response.status).toBe(202);
    expect(sendTelegramAlert).toHaveBeenCalledTimes(1);
    expect(sendTelegramAlert.mock.calls[0][0]).toContain("bad &lt;script&gt;");
    expect(sendTelegramAlert.mock.calls[0][0]).toContain("דני &lt;בדיקה&gt;");
  });

  it("does not resend an error while its fingerprint is in cooldown", async () => {
    execute.mockReset();
    execute.mockResolvedValueOnce({ rows: [{ reset_at: Date.now() + 60_000 }] });

    const { POST } = await import("@/app/api/client-errors/route");
    const response = await POST(request());
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.duplicate).toBe(true);
    expect(sendTelegramAlert).not.toHaveBeenCalled();
  });
});
