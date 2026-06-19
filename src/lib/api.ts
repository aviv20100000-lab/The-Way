export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(endpoint, {
    headers: { "Content-Type": "application/json" },
    ...options,
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
