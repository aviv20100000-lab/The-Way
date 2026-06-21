import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCsrfToken } from "@/lib/csrf-client";

interface User {
  id: string;
  name: string;
  email: string;
  role: "coach" | "client";
}

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else if (res.status === 401 || res.status === 403) {
          router.push("/login");
        }
      } catch (e) {
        console.error("Auth check failed:", e);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const logout = async () => {
    try {
      const headers: HeadersInit = {};
      const csrfToken = await getCsrfToken();
      if (csrfToken) headers["x-csrf-token"] = csrfToken;
      await fetch("/api/auth/logout", { method: "POST", headers });
      router.push("/login");
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  return {
    user,
    isLoading,
    logout,
  };
}
