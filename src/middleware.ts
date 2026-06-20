import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware() {
  const response = NextResponse.next();

  // Security headers applied to every response.
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.anthropic.com https://*.anthropic.com;"
  );

  // NOTE: No CSRF-token check here. The session cookie is set with
  // `sameSite: "lax"` + `httpOnly` (see src/lib/auth.ts), which already prevents
  // cross-site requests from carrying the user's session — that is the actual
  // CSRF protection. The previous custom double-submit token layer was redundant
  // and repeatedly broke legitimate requests (login, weight, food logging, and
  // any client running slightly stale JS), so it has been removed.

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
