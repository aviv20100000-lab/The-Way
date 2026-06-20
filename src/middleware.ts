import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyCSRFToken } from "@/lib/csrf";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.anthropic.com https://*.anthropic.com;"
  );

  // CSRF check for all POST/PUT/DELETE to /api/
  // Exceptions: GET requests, cron endpoints (they have their own secret-based auth)
  if (request.method === "POST" && request.nextUrl.pathname.startsWith("/api/")) {
    const pathname = request.nextUrl.pathname;

    // Skip CSRF only for cron endpoints (they have their own secret-based auth)
    const isCronEndpoint = pathname.includes("/cron/");

    if (!isCronEndpoint) {
      const csrfToken = request.headers.get("x-csrf-token");

      if (!csrfToken || !(await verifyCSRFToken(csrfToken))) {
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
