import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Edge-safe constant-time string comparison.
// NOTE: This must NOT import @/lib/csrf — that module uses next/headers cookies()
// and Node's crypto, which crash in the Edge Runtime middleware runs in
// (MIDDLEWARE_INVOCATION_FAILED). We do the double-submit-cookie check inline here.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers applied to every response.
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.anthropic.com https://*.anthropic.com;"
  );

  // CSRF protection: validate token on state-changing requests
  // SameSite cookie + httpOnly provides one layer, but CSRF token adds defense-in-depth
  if (request.method === "POST" && request.nextUrl.pathname.startsWith("/api/")) {
    const pathname = request.nextUrl.pathname;
    const isCronEndpoint = pathname.includes("/cron/");
    const isGenerateImageEndpoint = pathname.includes("/generate-water-image");

    if (!isCronEndpoint && !isGenerateImageEndpoint) {
      const csrfToken = request.headers.get("x-csrf-token");
      const cookieToken = request.cookies.get("csrf-token")?.value;
      if (!csrfToken || !cookieToken || !timingSafeEqual(csrfToken, cookieToken)) {
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
