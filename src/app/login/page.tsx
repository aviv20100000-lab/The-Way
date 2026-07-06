"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCsrfToken } from "@/lib/csrf-client";

function GyroscopeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx = context;

    // 2x DPR — crisp on retina
    const dpr = window.devicePixelRatio || 1;
    const W0 = canvas.offsetWidth, H0 = canvas.offsetHeight;
    canvas.width = W0 * dpr; canvas.height = H0 * dpr;
    ctx.scale(dpr, dpr);
    const W = W0, H = H0, cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.40;
    const FOV = 430;

    type Ring = { tiltX: number; tiltZ: number; yAngle: number; speed: number; lime: boolean; lineW: number };
    const rings: Ring[] = [
      { tiltX: 0,             tiltZ: 0,            yAngle: 0,   speed:  0.010, lime: true,  lineW: 1.6 },
      { tiltX: Math.PI/2,     tiltZ: 0,            yAngle: 0,   speed: -0.008, lime: true,  lineW: 1.4 },
      { tiltX: Math.PI/2.2,   tiltZ: Math.PI/4,    yAngle: 0,   speed:  0.006, lime: true,  lineW: 1.1 },
      { tiltX: Math.PI/3.5,   tiltZ: -Math.PI/3,   yAngle: 0,   speed: -0.005, lime: false, lineW: 0.7 },
      { tiltX: Math.PI/1.7,   tiltZ: Math.PI/6,    yAngle: 0,   speed:  0.004, lime: false, lineW: 0.5 },
    ];

    const TRAIL = 32;
    type Dot = { angle: number; speed: number; trail: { px: number; py: number }[] };
    const dots: Dot[][] = rings.map((_, ri) =>
      Array.from({ length: ri < 3 ? 2 : 1 }, (__, i) => ({
        angle: (i / 2) * Math.PI * 2 + Math.random(),
        speed: (0.026 + Math.random() * 0.010) * (Math.random() > 0.5 ? 1 : -1),
        trail: [],
      }))
    );

    let raf: number;

    function rotX(x: number, y: number, z: number, a: number) {
      return { x, y: y * Math.cos(a) - z * Math.sin(a), z: y * Math.sin(a) + z * Math.cos(a) };
    }
    function rotZ(x: number, y: number, z: number, a: number) {
      return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a), z };
    }
    function rotY(x: number, y: number, z: number, a: number) {
      return { x: x * Math.cos(a) + z * Math.sin(a), y, z: -x * Math.sin(a) + z * Math.cos(a) };
    }
    function transform(x: number, y: number, z: number, ring: Ring) {
      let p = rotX(x, y, z, ring.tiltX);
      p = rotZ(p.x, p.y, p.z, ring.tiltZ);
      p = rotY(p.x, p.y, p.z, ring.yAngle);
      return p;
    }
    function proj(x: number, y: number, z: number) {
      const s = FOV / (FOV + z);
      return { px: cx + x * s, py: cy + y * s, z };
    }

    function drawRing(ring: Ring, ringDots: Dot[]) {
      const STEPS = 150;
      // ring line
      for (let i = 0; i < STEPS; i++) {
        const t0 = (i / STEPS) * Math.PI * 2;
        const t1 = ((i + 1) / STEPS) * Math.PI * 2;
        const p0 = transform(R * Math.cos(t0), R * Math.sin(t0), 0, ring);
        const p1 = transform(R * Math.cos(t1), R * Math.sin(t1), 0, ring);
        const { px: x0, py: y0, z: z0 } = proj(p0.x, p0.y, p0.z);
        const { px: x1, py: y1 } = proj(p1.x, p1.y, p1.z);
        const depth = (z0 + R) / (2 * R);
        const alpha = ring.lime
          ? 0.10 + 0.80 * depth
          : 0.04 + 0.18 * depth;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = ring.lime
          ? `rgba(195,244,0,${alpha})`
          : `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = ring.lineW;
        ctx.stroke();
      }

      // dots with comet trail + bloom
      ringDots.forEach((dot) => {
        const p = transform(R * Math.cos(dot.angle), R * Math.sin(dot.angle), 0, ring);
        const { px, py, z } = proj(p.x, p.y, p.z);
        const depth = Math.max(0, (z + R) / (2 * R));

        dot.trail.push({ px, py });
        if (dot.trail.length > TRAIL) dot.trail.shift();

        // trail with screen blend
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (let t = 1; t < dot.trail.length; t++) {
          const a = dot.trail[t - 1], b = dot.trail[t];
          const fade = t / TRAIL;
          ctx.beginPath();
          ctx.moveTo(a.px, a.py);
          ctx.lineTo(b.px, b.py);
          ctx.strokeStyle = ring.lime
            ? `rgba(195,244,0,${fade * 0.65 * depth})`
            : `rgba(180,210,255,${fade * 0.28 * depth})`;
          ctx.lineWidth = fade * 3.5 * depth;
          ctx.stroke();
        }

        // outer bloom halo
        const size = 2.5 + depth * 4;
        ctx.beginPath();
        ctx.arc(px, py, size * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = ring.lime
          ? `rgba(195,244,0,${0.07 * depth})`
          : `rgba(180,210,255,${0.04 * depth})`;
        ctx.fill();

        // inner sharp core
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = ring.lime
          ? `rgba(220,255,80,${0.9 * depth})`
          : `rgba(200,225,255,${0.65 * depth})`;
        ctx.shadowBlur = 22 + depth * 18;
        ctx.shadowColor = ring.lime ? "#c3f400" : "#aaccff";
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        dot.angle += dot.speed;
      });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // pulsing center ambient glow
      const pulse = 0.05 + 0.025 * Math.sin(Date.now() / 650);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.65);
      g.addColorStop(0, `rgba(195,244,0,${pulse})`);
      g.addColorStop(0.45, "rgba(195,244,0,0.015)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      rings.forEach((ring, i) => {
        ring.yAngle += ring.speed;
        drawRing(ring, dots[i]);
      });


      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />;
}

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);

    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  // HARD RULE: the 2.3MB video must NEVER mount before the window load event
  // has fired. A <video> inserted pre-load delays the load event until it can
  // play — ~20s on cellular — and leaves NO Resource Timing entry on Safari,
  // which made this the "invisible" stall behind every 🐢 telemetry report
  // (2026-07-05). No early-mount shortcuts, no timers that race the load event.
  useEffect(() => {
    let revealed = false;
    const revealVideo = () => {
      if (revealed) return;
      revealed = true;
      window.removeEventListener("load", revealVideo);
      setShowVideo(true);
    };

    if (document.readyState === "complete") revealVideo();
    else window.addEventListener("load", revealVideo, { once: true });

    return () => window.removeEventListener("load", revealVideo);
  }, []);

  // Prefetch only after load so it cannot compete with initial presentation.
  useEffect(() => {
    let idleId: number | undefined;
    let idleFallbackId: ReturnType<typeof setTimeout> | undefined;
    let scheduled = false;
    const prefetchDashboards = () => {
      if (scheduled) return;
      scheduled = true;
      window.removeEventListener("load", prefetchDashboards);

      const run = () => {
        router.prefetch("/client");
        router.prefetch("/coach");
      };
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(run, { timeout: 3000 });
      } else {
        idleFallbackId = setTimeout(run, 1000);
      }
    };

    if (document.readyState === "complete") prefetchDashboards();
    else window.addEventListener("load", prefetchDashboards, { once: true });

    return () => {
      window.removeEventListener("load", prefetchDashboards);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (idleFallbackId !== undefined) clearTimeout(idleFallbackId);
    };
  }, [router]);

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
      body: JSON.stringify({ identifier, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "שגיאה בהתחברות");
      setLoading(false);
      return;
    }

    window.location.href = data.role === "coach" ? "/coach" : "/client";
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center overflow-hidden"
      dir="rtl"
      style={{ background: "#0c0f0f" }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 focus:z-50 focus:rounded-lg focus:bg-[#c3f400] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-[#161e00]"
      >
        דלג לתוכן הראשי
      </a>
      {prefersReducedMotion === false && showVideo && (
        <>
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-1000"
            onCanPlay={(e) => e.currentTarget.classList.remove("opacity-0")}
          >
            <source src="/videos/login-bg.mp4" type="video/mp4" />
          </video>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/80" />
        </>
      )}

      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-[#c3f400]/6 blur-[140px]" />
        <div className="absolute bottom-20 -left-20 w-72 h-72 rounded-full bg-[#c3f400]/4 blur-[120px]" />
      </div>

      {/* Branding */}
      <header className="relative z-10 w-full max-w-md px-6 pt-14 flex flex-col items-center text-center">
        <div
          className="mb-3 flex items-center justify-center rounded-2xl text-center font-black leading-tight"
          style={{
            width: "96px",
            height: "72px",
            fontSize: "13px",
            background: "linear-gradient(135deg, #1e2020, #282a2b)",
            border: "1.5px solid rgba(195,244,0,0.4)",
            color: "#c3f400",
            animation: "logo3d 6.3s ease-in-out infinite, logoPulse 3.2s ease-in-out infinite",
            transformStyle: "preserve-3d",
          }}
        >
          THE<br />WAY
        </div>
        <h1
          className="text-5xl font-black tracking-tight"
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #c3f400 60%, #abd600 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            animation: "shimmer 4s ease-in-out infinite",
            backgroundSize: "200% auto",
            letterSpacing: "-0.02em",
          }}
        >
          THE WAY
        </h1>
        <p className="mt-1 text-sm font-bold text-[#c3f400]">אפליקציה של כאבים</p>
        <style>{`
          @keyframes logo3d {
            0%   { transform: perspective(300px) rotateY(0deg)   rotateX(0deg); }
            25%  { transform: perspective(300px) rotateY(20deg)  rotateX(8deg); }
            50%  { transform: perspective(300px) rotateY(0deg)   rotateX(0deg); }
            75%  { transform: perspective(300px) rotateY(-20deg) rotateX(-8deg); }
            100% { transform: perspective(300px) rotateY(0deg)   rotateX(0deg); }
          }
          @keyframes logoPulse {
            0%, 100% { box-shadow: 0 0 24px rgba(195,244,0,0.2), inset 0 0 12px rgba(195,244,0,0.05); }
            50%       { box-shadow: 0 0 44px rgba(195,244,0,0.5), inset 0 0 20px rgba(195,244,0,0.12); }
          }
          @keyframes shimmer {
            0%   { background-position: 0% center; }
            50%  { background-position: 100% center; }
            100% { background-position: 0% center; }
          }
        `}</style>
      </header>

      {/* 3D Gyroscope */}
      <div className="relative z-10 w-full max-w-md" style={{ height: "240px" }}>
        <GyroscopeCanvas />
      </div>


      {/* Login form */}
      <main id="main-content" className="relative z-10 w-full max-w-md px-6 pb-12">
        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-7 space-y-5">
          <h2 className="text-2xl font-bold text-white">כניסה</h2>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm font-medium text-red-400">{error}</p>
            </div>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#c4c9ac]">מייל או שם משתמש</span>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="dani או name@example.com"
              required
              dir="ltr"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              disabled={loading}
              className="w-full rounded-xl border border-[#444933] bg-[#282a2b] px-4 py-3 text-white placeholder:text-[#8e9379] transition focus:border-[#c3f400] focus:outline-none focus:ring-2 focus:ring-[#c3f400]/20 disabled:opacity-50"
              aria-label="מייל או שם משתמש"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#c4c9ac]">סיסמה</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              dir="ltr"
              autoComplete="current-password"
              disabled={loading}
              className="w-full rounded-xl border border-[#444933] bg-[#282a2b] px-4 py-3 text-white placeholder:text-[#8e9379] transition focus:border-[#c3f400] focus:outline-none focus:ring-2 focus:ring-[#c3f400]/20 disabled:opacity-50"
              aria-label="סיסמה"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#c3f400] py-4 font-bold text-[#161e00] text-base shadow-[0_0_40px_-10px_rgba(195,244,0,0.5)] transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            aria-busy={loading}
          >
            {loading ? "נכנסים..." : "כניסה"}
          </button>
          <a href="/forgot-password" className="block text-center text-sm text-[#8e9379] hover:text-[#c3f400]">
            שכחת סיסמה?
          </a>
        </form>

        <p className="mt-5 text-center text-xs text-[#8e9379]">
          האפליקציה שלך לעקוב אחרי תזונה וכושר בדרך העילאית
        </p>
      </main>

      <footer className="relative z-10 pb-6 text-center">
        <a href="/accessibility" className="text-xs text-[#8e9379] hover:text-[#c3f400] hover:underline">
          הצהרת נגישות
        </a>
      </footer>
    </div>
  );
}
