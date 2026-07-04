"use client";

import { useRef, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * 3D tilt wrapper. The child card rotates in perspective toward the pointer,
 * with a soft glare highlight tracking the cursor/finger. Resets on leave.
 *
 * Pass the card's visual classes (e.g. "glass-card rounded-2xl p-8") via
 * `className` — they're applied to the rotating element so corners/padding
 * stay intact and the glare clips to the rounded shape.
 */
export default function TiltCard({
  children,
  className = "",
  max = 8,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Max rotation in degrees on each axis. */
  max?: number;
  /** Entrance animation delay in seconds. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    if (prefersReducedMotion || e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1
    el.style.setProperty("--ry", `${(px - 0.5) * 2 * max}deg`);
    el.style.setProperty("--rx", `${-(py - 0.5) * 2 * max}deg`);
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
    el.style.setProperty("--glare", "1");
  }

  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--glare", "0");
  }

  return (
    <div className="tilt-perspective" style={{ animationDelay: `${delay}s` }}>
      <div
        ref={ref}
        onPointerMove={prefersReducedMotion ? undefined : handleMove}
        onPointerLeave={prefersReducedMotion ? undefined : reset}
        onPointerUp={prefersReducedMotion ? undefined : reset}
        onPointerCancel={prefersReducedMotion ? undefined : reset}
        className={`tilt-card ${className}`}
      >
        <span className="tilt-glare" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
