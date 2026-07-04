import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCsrfToken } from "@/lib/csrf-client";

interface User {
  id: string;
  name: string;
  email: string;
  role: "coach" | "client";
}

const CACHE_KEY = "way_user";

function readCache(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(CACHE_KEY);
    return v ? (JSON.parse(v) as User) : null;
  } catch { return null; }
}

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const cachedUser = readCache();
    if (cachedUser) {
      setUser(cachedUser);
    }

    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const userData: User = await res.json();
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(userData));
          setUser(userData);
        } else if (res.status === 401 || res.status === 403) {
          sessionStorage.removeItem(CACHE_KEY);
          router.push("/login");
        }
      } catch (e) {
        console.error("Auth check failed:", e);
      } finally {
        setIsLoading(false);
      }
    };

    void checkAuth();
  }, [router]);

  const logout = async () => {
    try {
      const headers: HeadersInit = {};
      const csrfToken = await getCsrfToken();
      if (csrfToken) headers["x-csrf-token"] = csrfToken;
      await fetch("/api/auth/logout", { method: "POST", headers });
      // Wipe ALL cached data (home/chat/water/weight/user) so the next login
      // never briefly shows a different account's stale numbers.
      sessionStorage.clear();
      window.location.href = "/login";
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  return { user, isLoading, logout };
}
