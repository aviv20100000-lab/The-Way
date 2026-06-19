"use client";

import { useEffect } from "react";

export function CSRFTokenProvider() {
  useEffect(() => {
    async function initializeCSRFToken() {
      try {
        const response = await fetch("/api/auth/csrf-token", {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          // Token is already set in cookie by the server
        }
      } catch (error) {
        console.error("Failed to initialize CSRF token:", error);
      }
    }

    initializeCSRFToken();
  }, []);

  return null;
}
