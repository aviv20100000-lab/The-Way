"use client";

import { useEffect, useRef } from "react";

export default function AuroraBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      el.style.setProperty("--aurora-play", document.hidden ? "paused" : "running");
    };
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      <div className="aurora-blob aurora-blob--lime" />
      <div className="aurora-blob aurora-blob--cyan" />
      <div className="aurora-grain" />
    </div>
  );
}
