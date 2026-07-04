"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface AnimatedScoreProps {
  value: number;
  className?: string;
  animate?: boolean;
  precision?: number;
  format?: (value: number) => ReactNode;
}

export function AnimatedScore({
  value,
  className,
  animate = true,
  precision = 0,
  format,
}: AnimatedScoreProps) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const prev = useRef(0);

  useEffect(() => {
    if (!animate) {
      cancelAnimationFrame(rafRef.current);
      prev.current = value;
      setDisplay(value);
      return;
    }
    const start = prev.current;
    const end = value;
    const duration = 900;
    const startTime = performance.now();
    const precisionFactor = 10 ** precision;
    cancelAnimationFrame(rafRef.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const cur = Math.round((start + (end - start) * ease) * precisionFactor) / precisionFactor;
      setDisplay(cur);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else prev.current = end;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, animate, precision]);

  const formatted = format
    ? format(display)
    : display >= 1000
      ? `${(display / 1000).toFixed(1)}K`
      : display.toLocaleString();

  return <span className={className}>{formatted}</span>;
}
