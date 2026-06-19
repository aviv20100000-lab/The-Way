"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

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
    <div className="min-h-screen bg-gradient-to-b from-neutral-900 via-primary-900 to-primary-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background image overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/70 via-primary-900/65 to-primary-800/70 pointer-events-none" />

      {/* Animated gradient overlay for visual depth */}
      <motion.div
        className="absolute inset-0 opacity-20 pointer-events-none"
        initial={{ backgroundPosition: "0% 0%" }}
        animate={{ backgroundPosition: "100% 100%" }}
        transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
        style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, rgba(79, 70, 229, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(6, 182, 212, 0.2) 0%, transparent 50%)",
          backgroundSize: "200% 200%",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Header with animation */}
        <motion.div
          className="mb-8 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, type: "spring", stiffness: 100, damping: 15 }}
            className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-primary-600 text-lg shadow-2xl font-black text-white text-center leading-tight"
          >
            THE<br/>WAY
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold text-white tracking-tight">THE WAY</h1>
            <p className="text-xs font-medium text-primary-200 mt-1">by Aviv & Liav</p>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-3 text-lg text-neutral-200 font-medium"
          >
            הדרך שלך, היא הדרך שלנו.
          </motion.p>
        </motion.div>

        {/* Form card with animation */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="rounded-3xl bg-white/95 backdrop-blur-lg p-8 shadow-2xl ring-1 ring-white/20"
        >
          <h2 className="mb-7 text-2xl font-bold text-neutral-900">כניסה</h2>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 rounded-xl bg-red-100 p-4 border border-red-200"
            >
              <p className="text-sm font-medium text-red-700">{error}</p>
            </motion.div>
          )}

          {/* Email field */}
          <motion.label
            className="mb-5 block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
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
          </motion.label>

          {/* Password field */}
          <motion.label
            className="mb-7 block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
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
          </motion.label>

          {/* Submit button */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="w-full rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 py-3 font-semibold text-white shadow-lg transition hover:shadow-xl hover:from-primary-700 hover:to-primary-800 disabled:opacity-60 disabled:cursor-not-allowed"
            aria-busy={loading}
          >
            {loading ? (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="inline-flex items-center gap-2"
              >
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="inline-block"
                >
                  ⏳
                </motion.span>
                נכנסים...
              </motion.span>
            ) : (
              "כניסה"
            )}
          </motion.button>
        </motion.form>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-6 text-center text-sm text-neutral-300"
        >
          האפליקציה שלך לעקוב אחרי תזונה וכושר בדרך העילאית
        </motion.p>
      </div>
    </div>
  );
}
