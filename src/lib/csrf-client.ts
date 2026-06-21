// Client-side CSRF token helper.
// iOS Safari can be flaky about exposing freshly-set cookies via document.cookie,
// so if the cookie isn't readable we fetch a fresh token (the GET also re-sets the
// matching cookie, so cookie === header for the subsequent protected request).

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

export async function getCsrfToken(): Promise<string | null> {
  const existing = getCookie("csrf-token");
  if (existing) return existing;

  try {
    const res = await fetch("/api/auth/csrf-token", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      return data.token ?? getCookie("csrf-token");
    }
  } catch {
    // ignore
  }
  return getCookie("csrf-token");
}

// Convenience: merge the CSRF token into a headers object for a state-changing fetch.
export async function withCsrf(headers: HeadersInit = {}): Promise<HeadersInit> {
  const token = await getCsrfToken();
  return token ? { ...headers, "x-csrf-token": token } : headers;
}
