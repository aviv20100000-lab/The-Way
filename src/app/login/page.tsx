"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 text-3xl text-white shadow-lg">
            🥗
          </div>
          <h1 className="text-3xl font-bold text-gray-900">The Way</h1>
          <p className="mt-2 text-gray-500">מעקב תזונה חכם למאמנים ומתאמנים</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-8 shadow-xl">
          <h2 className="mb-6 text-xl font-semibold">התחברות</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-gray-700">אימייל</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              placeholder="your@email.com"
              required
              dir="ltr"
            />
          </label>

          <label className="mb-6 block">
            <span className="mb-1 block text-sm font-medium text-gray-700">סיסמה</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              placeholder="••••••"
              required
              dir="ltr"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "מתחבר..." : "התחבר"}
          </button>

          <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
            <p className="font-medium text-gray-800">חשבונות לדוגמה:</p>
            <p className="mt-1" dir="ltr">מאמן: coach@theway.com</p>
            <p dir="ltr">מתאמן: dani@theway.com</p>
            <p dir="ltr">סיסמה: 123456</p>
          </div>
        </form>
      </div>
    </div>
  );
}
