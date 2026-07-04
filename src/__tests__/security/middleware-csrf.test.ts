/**
 * @jest-environment node
 *
 * Tests CSRF enforcement in middleware.
 * Does not touch the DB or any external service.
 */

import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

function makeRequest(
  method: string,
  path: string,
  opts: { csrfHeader?: string; csrfCookie?: string } = {}
): NextRequest {
  const url = `http://localhost${path}`;
  const headers = new Headers();
  if (opts.csrfHeader) headers.set("x-csrf-token", opts.csrfHeader);
  // NextRequest doesn't accept Set-Cookie in the constructor the same way;
  // we simulate the cookie via the Cookie header.
  if (opts.csrfCookie) headers.set("cookie", `csrf-token=${opts.csrfCookie}`);
  return new NextRequest(url, { method, headers });
}

describe("Middleware — CSRF enforcement", () => {
  const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

  it.each(STATE_CHANGING_METHODS)(
    "%s /api/meals → 403 when CSRF token is absent",
    async (method) => {
      const req = makeRequest(method, "/api/meals");
      const res = await middleware(req);
      expect(res.status).toBe(403);
    }
  );

  it("POST /api/meals → 403 when header token doesn't match cookie token", async () => {
    const req = makeRequest("POST", "/api/meals", {
      csrfHeader: "token-a",
      csrfCookie: "token-b",
    });
    const res = await middleware(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/meals → passes CSRF check when tokens match", async () => {
    const token = "secure-test-token-abc123";
    const req = makeRequest("POST", "/api/meals", {
      csrfHeader: token,
      csrfCookie: token,
    });
    const res = await middleware(req);
    // Middleware passes; downstream handler would return non-403
    expect(res.status).not.toBe(403);
  });

  it("GET /api/meals → no CSRF check needed (read-only)", async () => {
    const req = makeRequest("GET", "/api/meals");
    const res = await middleware(req);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/cron/health-check → CSRF check is bypassed", async () => {
    const req = makeRequest("POST", "/api/cron/health-check");
    const res = await middleware(req);
    expect(res.status).not.toBe(403);
  });

  it("POST /api/auth/login → 403 without CSRF token", async () => {
    const req = makeRequest("POST", "/api/auth/login");
    const res = await middleware(req);
    expect(res.status).toBe(403);
  });

  it("Security headers are always set on responses", async () => {
    const req = makeRequest("GET", "/some-page");
    const res = await middleware(req);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });
});
