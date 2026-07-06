"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AnimatedScore } from "@/components/AnimatedScore";
import { generateMilestoneShareImage } from "@/lib/milestoneShareImage";

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
  const [shareImage, setShareImage] = useState<{ milestoneId: string; blob: Blob } | null>(null);
  const [isPreparingShareImage, setIsPreparingShareImage] = useState(false);
  const confettiParticles = useMemo(
    () => Array.from({ length: prefersReducedMotion || !milestone ? 0 : 12 }, (_, index) => ({
      id: index,
      startX: (Math.random() - 0.5) * 100,
      endX: (Math.random() - 0.5) * 200,
      rotate: Math.random() * 360,
      size: 5 + (index % 3) * 2,
    })),
    [milestone, prefersReducedMotion]
  );

  useEffect(() => {
    if (!milestone) return;
    try { navigator.vibrate?.(15); } catch {}
  }, [milestone]);

  useEffect(() => {
    if (!milestone) return;

    let cancelled = false;
    setIsPreparingShareImage(true);
    generateMilestoneShareImage(milestone)
      .then((blob) => {
        if (!cancelled) setShareImage({ milestoneId: milestone.id, blob });
      })
      .catch(() => {
        if (!cancelled) setShareImage(null);
      })
      .finally(() => {
        if (!cancelled) setIsPreparingShareImage(false);
      });

    return () => {
      cancelled = true;
    };
  }, [milestone]);

  const handleShare = async () => {
    if (!milestone || shareImage?.milestoneId !== milestone.id) return;

    const file = new File([shareImage.blob], "the-way-milestone.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] }) && typeof navigator.share === "function") {
      try {
        await navigator.share({ files: [file], text: `${milestone.message} 💪 The Way` });
      } catch (error: unknown) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Milestone sharing failed", error);
        }
      }
      return;
    }

    const url = URL.createObjectURL(shareImage.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "the-way-milestone.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

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
              className="pointer-events-none fixed rounded-full bg-[#c3f400]"
              style={{ width: particle.size, height: particle.size }}
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
            />
          ))}

          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: prefersReducedMotion ? 0.15 : 0.35, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
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
            <div className="mt-7 flex gap-3" dir="rtl">
              <button
                type="button"
                onClick={handleShare}
                aria-busy={isPreparingShareImage}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#c3f400] px-4 py-3 text-sm font-bold text-[#161e00] transition-opacity hover:opacity-90"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
                </svg>
                {shareImage?.milestoneId === milestone.id ? "שתף" : "מכין..."}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="flex-1 rounded-xl border border-[#444933] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/5"
              >
                הבנתי
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
