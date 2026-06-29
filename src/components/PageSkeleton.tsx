import BrandLogo from "@/components/BrandLogo";

/**
 * Branded, on-theme loading skeleton shown during route transitions and while
 * the initial auth check resolves. Pure CSS (no framer-motion) so it renders
 * instantly without waiting for the JS bundle to hydrate.
 */
export default function PageSkeleton({ variant = "dashboard" }: { variant?: "dashboard" | "chat" | "water" }) {
  return (
    <div
      className="min-h-screen bg-[#0c0f0f] text-[#e2e2e2] app-fade-in"
      dir="rtl"
      aria-busy="true"
      aria-label="טוען"
    >
      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: "linear-gradient(180deg, #0c0f0f 85%, transparent)" }}>
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3">
          <BrandLogo />
          <div className="flex items-center gap-2">
            <div className="skeleton h-11 w-11 rounded-lg" />
            <div className="skeleton h-11 w-20 rounded-lg" />
          </div>
        </div>
        <div className="h-px w-full bg-[#1a1c1c]" />
      </div>

      <main className="mx-auto max-w-lg px-5 pt-4">
        {variant === "chat" ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                <div
                  className="skeleton h-12 rounded-2xl"
                  style={{ width: `${50 + ((i * 13) % 35)}%` }}
                />
              </div>
            ))}
          </div>
        ) : variant === "water" ? (
          <div className="space-y-5 pt-2">
            {/* Title */}
            <div className="skeleton h-8 w-36 rounded-lg mx-auto" />
            {/* Hero image */}
            <div className="skeleton h-48 w-full rounded-3xl" />
            {/* Progress card */}
            <div className="skeleton h-32 w-full rounded-3xl" />
            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-3">
              <div className="skeleton h-16 rounded-2xl" />
              <div className="skeleton h-16 rounded-2xl" />
              <div className="skeleton h-16 rounded-2xl" />
            </div>
            {/* Motivation */}
            <div className="skeleton h-24 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Greeting */}
            <div className="space-y-2 pt-2">
              <div className="skeleton h-3 w-32 rounded" />
              <div className="skeleton h-8 w-44 rounded-lg" />
            </div>
            {/* Hero card */}
            <div className="skeleton h-40 w-full rounded-2xl" />
            {/* Two stat cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="skeleton h-44 rounded-2xl" />
              <div className="skeleton h-44 rounded-2xl" />
            </div>
            {/* Wide card */}
            <div className="skeleton h-28 w-full rounded-2xl" />
          </div>
        )}
      </main>
    </div>
  );
}
