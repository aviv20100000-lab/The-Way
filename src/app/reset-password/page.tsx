"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getCsrfToken } from "@/lib/csrf-client";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("קישור האיפוס חסר או לא תקין");
      return;
    }
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }

    setLoading(true);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      const csrfToken = await getCsrfToken();
      if (csrfToken) headers["x-csrf-token"] = csrfToken;

      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers,
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "אירעה שגיאה באיפוס הסיסמה");
        return;
      }
      setMessage(data.message);
    } catch {
      setError("אירעה שגיאה באיפוס הסיסמה");
    } finally {
      setLoading(false);
    }
  }

  if (message) {
    return (
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">הסיסמה עודכנה</h1>
        <p className="mt-4 text-[#c4c9ac]">{message}</p>
        <Link href="/login" className="mt-6 block w-full rounded-full bg-[#c3f400] py-4 font-bold text-[#161e00] hover:brightness-110">
          להתחברות
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold text-white">בחירת סיסמה חדשה</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#c4c9ac]">סיסמה חדשה</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="new-password"
            disabled={loading}
            className="w-full rounded-xl border border-[#444933] bg-[#282a2b] px-4 py-3 text-white focus:border-[#c3f400] focus:outline-none focus:ring-2 focus:ring-[#c3f400]/20 disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#c4c9ac]">אימות סיסמה</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            autoComplete="new-password"
            disabled={loading}
            className="w-full rounded-xl border border-[#444933] bg-[#282a2b] px-4 py-3 text-white focus:border-[#c3f400] focus:outline-none focus:ring-2 focus:ring-[#c3f400]/20 disabled:opacity-50"
          />
        </label>

        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={loading} className="w-full rounded-full bg-[#c3f400] py-4 font-bold text-[#161e00] hover:brightness-110 disabled:opacity-60">
          {loading ? "מעדכנים..." : "עדכון סיסמה"}
        </button>
      </form>
      <Link href="/login" className="mt-6 block text-center text-sm text-[#8e9379] hover:text-[#c3f400]">
        חזרה להתחברות
      </Link>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0c0f0f] px-6" dir="rtl">
      <section className="glass-card w-full max-w-md rounded-2xl p-7">
        <Suspense fallback={<p className="text-center text-[#8e9379]">טוענים...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </section>
    </main>
  );
}
