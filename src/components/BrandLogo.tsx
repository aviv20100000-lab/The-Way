"use client";

/**
 * THE WAY — premium animated brandmark.
 *
 * Orchestrated entrance (plays once on mount):
 *   1. A living lime "core" dot pops in with a cyan satellite orbiting it
 *      (echoes the login gyroscope).
 *   2. Each letter of THE WAY materialises out of blur, left-to-right.
 *   3. A gradient "path" line draws itself underneath (THE WAY = the journey).
 *   4. "by Aviv & Liav" fades up with expanded tracking.
 * Idle (continuous, slow): shimmer sweep across the wordmark + the dot breathes.
 *
 * Fully self-contained (scoped `twl-` styles), safe on iOS Safari, and
 * collapses gracefully under prefers-reduced-motion.
 */

const LETTERS = "THE WAY".split("");

export default function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`twl ${className}`} dir="ltr" aria-label="THE WAY — by Aviv & Liav">
      <div className="twl-main">
        {/* Wordmark — letters materialise out of blur */}
        <span className="twl-word">
          {LETTERS.map((ch, i) => (
            <span
              key={i}
              className="twl-letter"
              style={{ animationDelay: `${0.22 + i * 0.065}s` }}
            >
              {ch === " " ? " " : ch}
            </span>
          ))}
        </span>
      </div>

      {/* "The way" — a path that draws itself */}
      <span className="twl-line" aria-hidden="true" />

      <span className="twl-sub">by Aviv &amp; Liav</span>

      <style>{`
        .twl {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          user-select: none;
          line-height: 1;
        }
        .twl-main {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        /* ── living dot ────────────────────────── */
        .twl-dot {
          position: relative;
          width: 8px;
          height: 8px;
          flex-shrink: 0;
          animation: twlDotIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .twl-dot-core {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle at 34% 30%, #f6ffbf, #c3f400 58%, #93bd00);
          box-shadow:
            0 0 8px 2px rgba(195, 244, 0, 0.6),
            0 0 18px 4px rgba(195, 244, 0, 0.22);
          animation: twlBreathe 3.6s ease-in-out infinite;
        }

        /* ── wordmark ──────────────────────────── */
        .twl-word {
          display: inline-flex;
          font-weight: 900;
          font-size: 21px;
          letter-spacing: 0.09em;
        }
        /* Gradient + clip live on EACH letter — a transformed/filtered child
           breaks a parent's background-clip:text, leaving glyphs invisible. */
        .twl-letter {
          display: inline-block;
          background-image: linear-gradient(158deg,
            #5a8c00 0%,
            #8fc900 6%,
            #c3f400 13%,
            #f5ffe0 19%,
            #ffffff 22%,
            #fff8f0 24%,
            #c3f400 30%,
            #7ab500 38%,
            #9fd800 44%,
            #c3f400 50%,
            #edffd0 56%,
            #ffffff 60%,
            #f0faff 63%,
            #c3f400 70%,
            #a8dc00 78%,
            #f0ffe0 84%,
            #ffffff 87%,
            #c3f400 92%,
            #5a8c00 100%);
          background-size: 100% 520%;
          background-position: 0% 25%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          opacity: 0;
          transform: scale(0.55);
          filter: blur(8px);
          animation:
            twlLetterIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards,
            twlSheen 8s ease-in-out infinite;
        }

        /* ── path line ─────────────────────────── */
        .twl-line {
          width: 88px;
          height: 2px;
          border-radius: 2px;
          background: linear-gradient(90deg,
            transparent 0%,
            #c3f400 12%, #ffffff 32%, #eaffb0 46%,
            #c3f400 60%, #a6cf00 76%, #c3f400 88%,
            transparent 100%);
          background-size: 200% 100%;
          background-position: 0% 0%;
          transform: scaleX(0);
          transform-origin: left center;
          animation:
            twlLineIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.55s forwards,
            twlLineSweep 8s ease-in-out infinite;
        }

        /* ── subtitle ──────────────────────────── */
        .twl-sub {
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 0.45em;
          text-transform: uppercase;
          color: #6b7748;
          padding-left: 0.45em;
          opacity: 0;
          transform: translateY(3px);
          animation: twlSubIn 0.8s ease 0.95s forwards;
        }

        @keyframes twlLetterIn {
          to { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes twlDotIn {
          from { opacity: 0; transform: scale(0); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes twlBreathe {
          0%, 100% { box-shadow: 0 0 8px 2px rgba(195,244,0,0.6), 0 0 18px 4px rgba(195,244,0,0.22); }
          50%      { box-shadow: 0 0 11px 3px rgba(195,244,0,0.85), 0 0 26px 7px rgba(195,244,0,0.38); }
        }
        @keyframes twlSheen {
          0%, 100% { background-position: 0% 0%; }
          50%      { background-position: 0% 100%; }
        }
        @keyframes twlLineSweep {
          0%, 100% { background-position: 0% 0%; }
          50%      { background-position: 100% 0%; }
        }
        @keyframes twlLineIn {
          to { transform: scaleX(1); }
        }
        @keyframes twlSubIn {
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .twl-dot-core { animation: none !important; }
          .twl-letter { animation: none !important; opacity: 1; transform: none; filter: none; }
          .twl-line { animation: none !important; transform: scaleX(1); }
          .twl-sub { animation: none !important; opacity: 1; transform: none; }
          .twl-dot { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
