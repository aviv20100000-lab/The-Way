"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AnimatedScore } from "@/components/AnimatedScore";

export interface MilestoneCelebrationData {
  id: string;
  value: number;
  suffix: string;
  message: string;
}

interface MilestoneCelebrationProps {
  milestone: MilestoneCelebrationData | null;
  onDismiss: () => void;
}

export default function MilestoneCelebration({ milestone, onDismiss }: MilestoneCelebrationProps) {
  const prefersReducedMotion = useReducedMotion();
  const onDismissRef = useRef(onDismiss);
  const confettiParticles = useMemo(
    () => Array.from({ length: prefersReducedMotion || !milestone ? 0 : 12 }, (_, index) => ({
      id: index,
      startX: (Math.random() - 0.5) * 100,
      endX: (Math.random() - 0.5) * 200,
      rotate: Math.random() * 360,
      icon: index === 0 ? "🎉" : ["✨", "🌟", "💧"][index % 3],
    })),
    [milestone, prefersReducedMotion]
  );

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!milestone) return;
    try { navigator.vibrate?.(15); } catch {}
    const timeout = window.setTimeout(() => onDismissRef.current(), 4000);
    return () => window.clearTimeout(timeout);
  }, [milestone]);

  return (
    <AnimatePresence>
      {milestone && (
        <motion.div
          key={milestone.id}
          role="dialog"
          aria-modal="true"
          aria-label="חגיגת אבן דרך"
          onClick={onDismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.15 : 0.25 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm"
        >
          {confettiParticles.map((particle) => (
            <motion.div
              key={particle.id}
              className="pointer-events-none fixed text-2xl"
              initial={{
                x: `calc(50vw + ${particle.startX}px)`,
                y: "50vh",
                opacity: 1,
              }}
              animate={{
                x: `calc(50vw + ${particle.endX}px)`,
                y: "10vh",
                opacity: 0,
                rotate: particle.rotate,
              }}
              transition={{ duration: 1.6, ease: "easeOut" }}
            >
              {particle.icon}
            </motion.div>
          ))}

          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: prefersReducedMotion ? 0.15 : 0.35, ease: "easeOut" }}
            className="glass-card relative w-full max-w-sm rounded-2xl border border-[#2e3030] px-6 py-8 text-center shadow-2xl"
          >
            <p className="text-sm font-semibold text-[#c3f400]">אבן דרך חדשה</p>
            <div className="mt-4 flex items-baseline justify-center gap-2 text-white">
              <AnimatedScore
                value={milestone.value}
                animate={!prefersReducedMotion}
                className="text-6xl font-black leading-none"
              />
              <span className="text-lg font-semibold text-[#c4c9ac]">{milestone.suffix}</span>
            </div>
            <p className="mt-5 text-base font-semibold text-white">{milestone.message}</p>
            <p className="mt-3 text-xs text-[#8e9379]">לחץ בכל מקום כדי להמשיך</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
