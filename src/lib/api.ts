import { getCsrfToken } from "@/lib/csrf-client";

export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const headers: HeadersInit = { "Content-Type": "application/json" };

  if (options?.method && ["POST", "PUT", "DELETE", "PATCH"].includes(options.method)) {
    const csrfToken = await getCsrfToken();
    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken;
    }
  }

  const res = await fetch(endpoint, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    let errorMessage = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      errorMessage = data.error || errorMessage;
    } catch {
      // ignore
    }

    throw new Error(errorMessage);
  }

  return res.json();
}
