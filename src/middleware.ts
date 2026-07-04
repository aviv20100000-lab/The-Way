import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

async function getAuthRedirect(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return null;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api/") || pathname === "/favicon.ico") return null;
  // Public static assets under /public (images, videos, manifest, etc.) never need auth.
  if (/\.(mp4|webm|jpg|jpeg|png|gif|webp|svg|ico|json|txt|woff2?)$/i.test(pathname)) return null;

  const token = request.cookies.get("the-way-session")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
    await jwtVerify(token, secret);
    return null;
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

// Edge-safe constant-time string comparison.
// NOTE: This must NOT import @/lib/csrf because that module uses next/headers
// cookies() and Node crypto APIs that are not safe in Edge middleware.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  const isProduction = process.env.NODE_ENV === "production";

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-site");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.anthropic.com https://*.anthropic.com",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
      isProduction ? "upgrade-insecure-requests" : "",
    ]
      .filter(Boolean)
      .join("; ")
  );

  if (isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  return response;
}

export async function middleware(request: NextRequest) {
  // Security headers go on every response — including the login redirect.
  const authRedirect = await getAuthRedirect(request);
  if (authRedirect) return applySecurityHeaders(authRedirect);

  const response = applySecurityHeaders(NextResponse.next());

  // Validate double-submit CSRF token on state-changing API requests.
  const csrfProtectedMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  if (csrfProtectedMethods.has(request.method) && request.nextUrl.pathname.startsWith("/api/")) {
    const isCronEndpoint = request.nextUrl.pathname.includes("/cron/");

    if (!isCronEndpoint) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
