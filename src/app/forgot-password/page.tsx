"use client";

import { useState } from "react";
import Link from "next/link";
import { getCsrfToken } from "@/lib/csrf-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetLink, setResetLink] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    setResetLink("");

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      const csrfToken = await getCsrfToken();
      if (csrfToken) headers["x-csrf-token"] = csrfToken;

      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers,
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "אירעה שגיאה. נסה שוב מאוחר יותר.");
        return;
      }

      setMessage(data.message);
      if (typeof data.resetLink === "string") setResetLink(data.resetLink);
    } catch {
      setError("אירעה שגיאה. נסה שוב מאוחר יותר.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0c0f0f] px-6" dir="rtl">
      <section className="glass-card w-full max-w-md rounded-2xl p-7">
        <h1 className="text-3xl font-bold text-white">איפוס סיסמה</h1>
        <p className="mt-2 text-sm text-[#8e9379]">הזן שם משתמש או אימייל לקבלת קישור לאיפוס.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#c4c9ac]">שם משתמש או אימייל</span>
            <input
              type="text"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              dir="ltr"
              autoComplete="username"
              disabled={loading}
              className="w-full rounded-xl border border-[#444933] bg-[#282a2b] px-4 py-3 text-white transition focus:border-[#c3f400] focus:outline-none focus:ring-2 focus:ring-[#c3f400]/20 disabled:opacity-50"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#c3f400] py-4 font-bold text-[#161e00] transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "שולחים..." : "שליחת קישור"}
          </button>
        </form>

        {message && <p className="mt-5 rounded-xl border border-[#c3f400]/30 bg-[#c3f400]/10 p-4 text-sm text-[#dff58a]">{message}</p>}
        {error && <p className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</p>}
        {resetLink && (
          <a href={resetLink} className="mt-4 block break-all text-sm font-semibold text-[#c3f400] underline">
            פתיחת קישור האיפוס המקומי
          </a>
        )}

        <Link href="/login" className="mt-6 block text-center text-sm text-[#8e9379] hover:text-[#c3f400]">
          חזרה להתחברות
        </Link>
      </section>
    </main>
  );
}
