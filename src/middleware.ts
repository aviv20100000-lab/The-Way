import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

// Constant-time string comparison (Edge-runtime safe, no Node crypto).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.anthropic.com https://*.anthropic.com;"
  );

  // CSRF check for all POST requests to /api/ (double-submit cookie pattern).
  // Exceptions: cron endpoints (own secret auth) and login (unauthenticated).
  // NOTE: this runs in the Edge Runtime, so no Node `crypto` / `next/headers` here.
  if (request.method === "POST" && request.nextUrl.pathname.startsWith("/api/")) {
    const pathname = request.nextUrl.pathname;

    const isCronEndpoint = pathname.includes("/cron/");
    const isLoginEndpoint = pathname.includes("/auth/login");

    if (!isCronEndpoint && !isLoginEndpoint) {
      const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
      const headerToken = request.headers.get(CSRF_HEADER_NAME);

      if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
        return NextResponse.json(
          { error: "בקשה לא תקינה (CSRF token missing)" },
          { status: 403 }
        );
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
