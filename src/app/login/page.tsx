"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCsrfToken } from "@/lib/csrf-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const headers: HeadersInit = { "Content-Type": "application/json" };
    const csrfToken = await getCsrfToken();
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "שגיאה בהתחברות");
      setLoading(false);
      return;
    }

    router.push(data.role === "coach" ? "/coach" : "/client");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-900 via-primary-900 to-primary-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background image overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/70 via-primary-900/65 to-primary-800/70 pointer-events-none" />

      {/* Animated gradient overlay for visual depth */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, rgba(79, 70, 229, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(6, 182, 212, 0.2) 0%, transparent 50%)",
          backgroundSize: "200% 200%",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Header with animation */}
        <div
          className="mb-8 text-center"
        >
          <div
            className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-primary-600 text-lg shadow-2xl font-black text-white text-center leading-tight"
          >
            THE<br/>WAY
          </div>

          <div
          >
            <h1 className="text-4xl font-bold text-white tracking-tight">THE WAY</h1>
            <p className="text-xs font-medium text-primary-200 mt-1">by Aviv & Liav</p>
          </div>

          <p
            className="mt-3 text-lg text-neutral-200 font-medium"
          >
            הדרך שלך, היא הדרך שלנו.
          </p>
        </div>

        {/* Form card with animation */}
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-white/95 backdrop-blur-lg p-8 shadow-2xl ring-1 ring-white/20"
        >
          <h2 className="mb-7 text-2xl font-bold text-neutral-900">כניסה</h2>

          {/* Error message */}
          {error && (
            <div
              className="mb-5 rounded-xl bg-red-100 p-4 border border-red-200"
            >
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          {/* Email field */}
          <label
            className="mb-5 block"
          >
            <span className="mb-2 block text-sm font-semibold text-neutral-700">אימייל</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              dir="ltr"
              disabled={loading}
              className="w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 transition focus:border-primary-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-600/30 disabled:opacity-50"
              aria-label="אימייל"
            />
          </label>

          {/* Password field */}
          <label
            className="mb-7 block"
          >
            <span className="mb-2 block text-sm font-semibold text-neutral-700">סיסמה</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
              dir="ltr"
              disabled={loading}
              className="w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 transition focus:border-primary-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-600/30 disabled:opacity-50"
              aria-label="סיסמה"
            />
          </label>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 py-3 font-semibold text-white shadow-lg transition hover:shadow-xl hover:from-primary-700 hover:to-primary-800 disabled:opacity-60 disabled:cursor-not-allowed"
            aria-busy={loading}
          >
            {loading ? (
              <span
                className="inline-flex items-center gap-2"
              >
                <span
                  className="inline-block"
                >
                  ⏳
                </span>
                נכנסים...
              </span>
            ) : (
              "כניסה"
            )}
          </button>
        </form>

        {/* Footer note */}
        <p
          className="mt-6 text-center text-sm text-neutral-300"
        >
          האפליקציה שלך לעקוב אחרי תזונה וכושר בדרך העילאית
        </p>
      </div>
    </div>
  );
}
